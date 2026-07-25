import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';

import { Package, PackageDocument } from '../../shared/schemas/package.schema';
import { User, UserDocument } from '../../shared/schemas/user.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto, CancelBookingDto } from './dto/update-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import {
  BookingStatus,
  PaymentStatus,
  VehicleType,
} from '../../common/enum/package.enum';
import { haversineKm, estimatePrice } from '../../common/utils/pricing.util';
import { generateTrackingNumber } from '../../common/utils/tracking.util';
import { normalisePhone } from '../../common/utils/phone.util';
import { Role } from '../../common/enum/role.enum';
import { DriverAvailabilityStatus } from '../../common/enum/driver-availability-status.enum';
import {
  Coordinate,
  OsrmRouteDetails,
  OsrmService,
} from '../../shared/osrm/osrm.service';
import { createHmac, timingSafeEqual } from 'crypto';
import { QuoteExpressDeliveryDto } from './dto/quote-express-delivery.dto';
import {
  ExpressVerificationPurpose,
  VerifyExpressDeliveryDto,
} from './dto/verify-express-delivery.dto';

const PHNOM_PENH_CENTER = { latitude: 11.5564, longitude: 104.9282 };
const EXPRESS_SERVICE_RADIUS_KM = 30;
const DEFAULT_BROADCAST_RADIUS_KM = 8;
const BROADCAST_DURATION_MS = 5 * 60 * 1000;
const EXPRESS_SIMULATION_SPEED_KMH = 75;
const MIN_SIMULATION_DURATION_SECONDS = 15;
const MAX_SIMULATION_DURATION_SECONDS = 3600;

// Shape of req.user injected by JwtStrategy
interface RequestUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  role: Role;
}

@Injectable()
export class PackagesService {
  private readonly logger = new Logger(PackagesService.name);

  constructor(
    @InjectModel(Package.name)
    private readonly packageModel: Model<PackageDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    private readonly osrmService: OsrmService,
  ) {}

  async create(dto: CreateBookingDto, user: RequestUser) {
    const dbUser = await this.userModel.findById(user._id);
    if (!dbUser) {
      throw new NotFoundException('User not found.');
    }

    const pickupPhone = dto.pickup.phone
      ? normalisePhone(dto.pickup.phone)
      : normalisePhone(dbUser.phone);

    if (!pickupPhone) {
      throw new BadRequestException(
        'Pickup phone is required. Please provide a phone number or ensure your user profile has a phone number.',
      );
    }

    const pickup = {
      ...dto.pickup,
      contactName: dto.pickup.contactName?.trim() || dbUser.name,
      phone: pickupPhone,
    };

    const dropoff = {
      ...dto.dropoff,
      phone: normalisePhone(dto.dropoff.phone),
    };

    const isExpress = dto.serviceType !== 'WAREHOUSE';
    let deliveryRoute: OsrmRouteDetails | null = null;
    if (isExpress) {
      this.assertExpressVehicle(dto.vehicleType);
      this.assertExpressCapacity(dto);
      this.assertInsidePhnomPenh(pickup, 'Pickup');
      this.assertInsidePhnomPenh(dropoff, 'Drop-off');
      deliveryRoute = await this.osrmService.getRouteDetails([pickup, dropoff]);
      if (!deliveryRoute) {
        throw new ServiceUnavailableException(
          'Unable to calculate a road route for this delivery.',
        );
      }
    }
    const distanceKm = deliveryRoute
      ? deliveryRoute.distanceMeters / 1000
      : haversineKm(
          pickup.latitude,
          pickup.longitude,
          dropoff.latitude,
          dropoff.longitude,
        );
    const estimatedPrice = estimatePrice(distanceKm, dto.vehicleType);
    const nearbyDrivers = isExpress
      ? await this.findNearbyAvailableDrivers(
          pickup,
          dto.vehicleType,
          DEFAULT_BROADCAST_RADIUS_KM,
        )
      : [];
    const broadcastedAt = isExpress ? new Date() : null;

    if (dto.scheduledAt) {
      const scheduled = new Date(dto.scheduledAt);
      if (scheduled <= new Date()) {
        throw new BadRequestException(
          'scheduledAt must be a future date and time.',
        );
      }
    }

    const pkg = await this.packageModel.create({
      trackingNumber: generateTrackingNumber(),
      customerId: user._id,
      vehicleType: dto.vehicleType,
      serviceType: isExpress ? 'EXPRESS' : 'WAREHOUSE',
      package: {
        name: dto.package.name,
        type: dto.package.type,
        quantity: dto.package.quantity,
        weightKg: dto.package.weightKg ?? null,
        images: dto.package.images ?? [],
        note: dto.package.note ?? null,
      },
      pickup,
      dropoff,
      payment: {
        payer: dto.payment.payer,
        method: dto.payment.method,
        status: PaymentStatus.PENDING,
        amount: estimatedPrice,
      },
      status: BookingStatus.PENDING,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      estimatedDistanceKm: Math.round(distanceKm * 100) / 100,
      estimatedPrice,
      driverId: null,
      broadcastDriverIds: nearbyDrivers.map((driver) => driver._id),
      broadcastedAt,
      broadcastExpiresAt: broadcastedAt
        ? new Date(broadcastedAt.getTime() + BROADCAST_DURATION_MS)
        : null,
      broadcastAttempt: isExpress ? 1 : 0,
      broadcastRadiusKm: DEFAULT_BROADCAST_RADIUS_KM,
      deliveryRoutePoints: deliveryRoute?.points ?? [],
      deliveryRouteDistanceMeters: deliveryRoute?.distanceMeters ?? null,
      deliveryRouteDurationSeconds: deliveryRoute?.durationSeconds ?? null,
      simulationDurationSeconds: 30,
      simulationProgress: 0,
      simulationPhaseStartedAt: null,
    });

    this.logger.log(
      `Package created: ${pkg.trackingNumber} by user ${user._id}`,
    );
    this.logger.log(`Created booking ID: ${pkg._id}`);

    // Trigger AI mapping in background safely
    this.triggerAutoMapping(pkg).catch((err) =>
      this.logger.error(`AutoMapping Trigger Error (Async): ${err.message}`),
    );

    return this.serializeForCustomer(pkg);
  }

  async quoteExpress(dto: QuoteExpressDeliveryDto) {
    this.assertExpressVehicle(dto.vehicleType);
    this.assertInsidePhnomPenh(dto.pickup, 'Pickup');
    this.assertInsidePhnomPenh(dto.dropoff, 'Drop-off');
    const route = await this.osrmService.getRouteDetails([
      dto.pickup,
      dto.dropoff,
    ]);
    if (!route) {
      throw new ServiceUnavailableException(
        'Unable to calculate a road route for this delivery.',
      );
    }
    const distanceKm = route.distanceMeters / 1000;
    const amountUsd = estimatePrice(distanceKm, dto.vehicleType);
    return {
      vehicleType: dto.vehicleType,
      distanceKm: Math.round(distanceKm * 100) / 100,
      durationSeconds: route.durationSeconds,
      amountUsd,
      amountKhr: Math.round((amountUsd * 4100) / 100) * 100,
      routePoints: route.points,
    };
  }

  async findMyBookings(userId: string, query: QueryBookingDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    return this.paginatedQuery(
      { customerId: new Types.ObjectId(userId) },
      query,
    );
  }

  async findDriverBookings(driverId: string, query: QueryBookingDto) {
    if (!Types.ObjectId.isValid(driverId)) {
      throw new BadRequestException('Invalid driver ID format.');
    }
    return this.paginatedQuery(
      { driverId: new Types.ObjectId(driverId) },
      query,
    );
  }

  async findOne(id: string, user: RequestUser) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid package ID format.');
    }

    const pkg = await this.packageModel
      .findById(id)
      .populate('customerId', 'name email phone')
      .populate('driverId', 'name email phone isOnline currentLocation')
      .exec();

    if (!pkg) throw new NotFoundException('Package not found.');

    const customerIdStr =
      (pkg.customerId as any)._id?.toString() || pkg.customerId.toString();
    const isCustomerOwner = customerIdStr === user._id.toString();
    const isAssignedDriver =
      pkg.driverId &&
      ((pkg.driverId as any)._id?.toString() || pkg.driverId.toString()) ===
        user._id.toString();

    if (user.role !== Role.ADMIN && !isCustomerOwner && !isAssignedDriver) {
      throw new ForbiddenException('You do not have access to this package.');
    }

    return isCustomerOwner
      ? this.serializeForCustomer(pkg)
      : this.serializeForDriver(pkg);
  }

  async findByTrackingNumber(trackingNumber: string) {
    const pkg = await this.packageModel
      .findOne({ trackingNumber: trackingNumber.toUpperCase() })
      .select('-payment.amount -customerId')
      .exec();

    if (!pkg) throw new NotFoundException('Tracking number not found.');
    return pkg;
  }

  async findAll(query: QueryBookingDto) {
    return this.paginatedQuery({}, query);
  }

  async update(
    id: string,
    dto: UpdateBookingDto,
    user: RequestUser,
  ): Promise<PackageDocument> {
    const pkg = await this.packageModel.findById(id);
    if (!pkg) throw new NotFoundException('Package not found.');

    this.assertOwner(pkg, user);
    this.assertPending(pkg, 'edit');

    const pickup = dto.pickup
      ? {
          ...pkg.pickup,
          ...dto.pickup,
          contactName: dto.pickup.contactName?.trim() || pkg.pickup.contactName,
          phone: dto.pickup.phone
            ? normalisePhone(dto.pickup.phone)
            : pkg.pickup.phone,
        }
      : pkg.pickup;

    const dropoff = dto.dropoff
      ? {
          ...pkg.dropoff,
          ...dto.dropoff,
          phone: normalisePhone(dto.dropoff.phone),
        }
      : pkg.dropoff;

    const vehicleType = dto.vehicleType ?? pkg.vehicleType;

    let distanceKm = pkg.estimatedDistanceKm;
    let estimatedPrice = pkg.estimatedPrice;

    if (dto.pickup || dto.dropoff || dto.vehicleType) {
      distanceKm = haversineKm(
        pickup.latitude,
        pickup.longitude,
        dropoff.latitude,
        dropoff.longitude,
      );
      estimatedPrice = estimatePrice(distanceKm, vehicleType);
    }

    if (dto.scheduledAt) {
      const scheduled = new Date(dto.scheduledAt);
      if (scheduled <= new Date()) {
        throw new BadRequestException('scheduledAt must be a future date.');
      }
    }

    // Update document by modifying properties directly and saving
    // This ensures nested objects like package, pickup, dropoff are properly merged
    if (dto.vehicleType) pkg.vehicleType = dto.vehicleType;
    if (dto.package) pkg.package = { ...pkg.package, ...dto.package };
    if (dto.pickup) pkg.pickup = pickup;
    if (dto.dropoff) pkg.dropoff = dropoff;
    if (dto.payment)
      pkg.payment = { ...pkg.payment, ...dto.payment, amount: estimatedPrice };
    if (dto.scheduledAt !== undefined) {
      pkg.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    }
    pkg.estimatedDistanceKm = Math.round(distanceKm! * 100) / 100;
    pkg.estimatedPrice = estimatedPrice;

    const updated = await pkg.save();

    this.logger.log(`Package updated: ${pkg.trackingNumber}`);
    return updated;
  }

  async cancel(
    id: string,
    dto: CancelBookingDto,
    user: RequestUser,
  ): Promise<PackageDocument> {
    const pkg = await this.packageModel.findById(id);
    if (!pkg) throw new NotFoundException('Package not found.');

    if (user.role !== Role.ADMIN) this.assertOwner(pkg, user);
    this.assertPending(pkg, 'cancel');

    const cancelled = await this.packageModel
      .findByIdAndUpdate(
        id,
        {
          status: BookingStatus.CANCELLED,
          cancellationReason: dto.reason ?? null,
          cancelledAt: new Date(),
        },
        { new: true },
      )
      .exec();

    this.logger.log(`Package cancelled: ${pkg.trackingNumber}`);
    return cancelled!;
  }

  async remove(id: string): Promise<{ message: string }> {
    const pkg = await this.packageModel.findByIdAndDelete(id);
    if (!pkg) throw new NotFoundException('Package not found.');
    this.logger.log(`Package hard-deleted: ${pkg.trackingNumber}`);
    return { message: 'Package deleted.' };
  }

  async findAvailable(driverId: string) {
    const driver = await this.getAvailableExpressDriver(driverId);
    const location = driver.driverProfile!.currentLocation!;
    const vehicleTypes = this.compatibleRequestVehicleTypes(driver);
    const packages = await this.packageModel
      .find({
        status: BookingStatus.PENDING,
        driverId: null,
        serviceType: { $ne: 'WAREHOUSE' },
        vehicleType: { $in: vehicleTypes },
        $or: [
          { broadcastExpiresAt: { $gt: new Date() } },
          { broadcastExpiresAt: null },
        ],
      })
      .populate('customerId', 'name email phone avatarUrl')
      .exec();
    return packages
      .filter((pkg) => {
        const distance = haversineKm(
          location.lat,
          location.lng,
          pkg.pickup.latitude,
          pkg.pickup.longitude,
        );
        return (
          distance <= (pkg.broadcastRadiusKm || DEFAULT_BROADCAST_RADIUS_KM)
        );
      })
      .map((pkg) => ({
        ...pkg.toObject(),
        driverStartLocation: {
          latitude: location.lat,
          longitude: location.lng,
        },
      }));
  }

  async acceptPackage(
    packageId: string,
    driverId: string,
  ): Promise<PackageDocument> {
    if (!Types.ObjectId.isValid(packageId)) {
      throw new BadRequestException('Invalid package ID.');
    }
    const driver = await this.getAvailableExpressDriver(driverId);
    const pending = await this.packageModel.findOne({
      _id: packageId,
      status: BookingStatus.PENDING,
      driverId: null,
      serviceType: { $ne: 'WAREHOUSE' },
      $or: [
        { broadcastExpiresAt: { $gt: new Date() } },
        { broadcastExpiresAt: null },
      ],
    });
    if (!pending) {
      throw new ConflictException(
        'This request has already been accepted or is no longer available.',
      );
    }
    if (!this.driverSupportsRequest(driver, pending.vehicleType)) {
      throw new ForbiddenException(
        'This request requires a different vehicle type.',
      );
    }

    const driverLocation = driver.driverProfile!.currentLocation!;
    const pickupDistance = haversineKm(
      driverLocation.lat,
      driverLocation.lng,
      pending.pickup.latitude,
      pending.pickup.longitude,
    );
    if (
      pickupDistance >
      (pending.broadcastRadiusKm || DEFAULT_BROADCAST_RADIUS_KM)
    ) {
      throw new ForbiddenException(
        'This pickup is outside your delivery request radius.',
      );
    }

    const [pickupRoute, deliveryRoute] = await Promise.all([
      this.osrmService.getRouteDetails([
        {
          latitude: driverLocation.lat,
          longitude: driverLocation.lng,
        },
        pending.pickup,
      ]),
      this.osrmService.getRouteDetails([pending.pickup, pending.dropoff]),
    ]);
    if (!pickupRoute || !deliveryRoute) {
      throw new ServiceUnavailableException(
        'Unable to calculate the driver route for this delivery.',
      );
    }

    const acceptedAt = new Date();
    const reservedDriver = await this.userModel
      .findOneAndUpdate(
        {
          _id: driver._id,
          availabilityStatus: DriverAvailabilityStatus.AVAILABLE,
          'driverProfile.isOnline': true,
        },
        { $set: { availabilityStatus: DriverAvailabilityStatus.ON_TRIP } },
        { new: true },
      )
      .exec();
    if (!reservedDriver) {
      throw new ConflictException(
        'This driver is already handling another delivery.',
      );
    }

    let pkg: PackageDocument | null;
    try {
      pkg = await this.packageModel
        .findOneAndUpdate(
          {
            _id: packageId,
            status: BookingStatus.PENDING,
            driverId: null,
            serviceType: { $ne: 'WAREHOUSE' },
            $or: [
              { broadcastExpiresAt: { $gt: acceptedAt } },
              { broadcastExpiresAt: null },
            ],
          },
          {
            $set: {
              status: BookingStatus.ACCEPTED,
              driverId: driver._id,
              acceptedAt,
              driverStartLocation: {
                latitude: driverLocation.lat,
                longitude: driverLocation.lng,
              },
              pickupRoutePoints: pickupRoute.points,
              pickupRouteDistanceMeters: pickupRoute.distanceMeters,
              pickupRouteDurationSeconds: pickupRoute.durationSeconds,
              deliveryRoutePoints: deliveryRoute.points,
              deliveryRouteDistanceMeters: deliveryRoute.distanceMeters,
              deliveryRouteDurationSeconds: deliveryRoute.durationSeconds,
              simulationDurationSeconds: this.simulationDurationForDistance(
                pickupRoute.distanceMeters,
              ),
              simulationProgress: 0,
              simulationPhaseStartedAt: acceptedAt,
            },
          },
          { new: true },
        )
        .exec();
    } catch (error) {
      await this.releaseReservedDriver(driver._id);
      throw error;
    }
    if (!pkg) {
      await this.releaseReservedDriver(driver._id);
      throw new ConflictException(
        'Another driver accepted this request first.',
      );
    }

    // Notify FastAPI
    this.notifyAcceptance(pkg, driverId.toString()).catch((err) =>
      this.logger.error(
        `FastAPI Acceptance Notification Error: ${err.message}`,
      ),
    );

    return this.populatePackage(pkg._id.toString());
  }

  async retryBroadcast(packageId: string, user: RequestUser) {
    if (!Types.ObjectId.isValid(packageId)) {
      throw new BadRequestException('Invalid package ID.');
    }
    const pkg = await this.packageModel.findById(packageId);
    if (!pkg) throw new NotFoundException('Package not found.');
    if (user.role !== Role.ADMIN) this.assertOwner(pkg, user);
    if (
      pkg.serviceType === 'WAREHOUSE' ||
      pkg.status !== BookingStatus.PENDING ||
      pkg.driverId
    ) {
      throw new ConflictException(
        'Only an unmatched express delivery can be broadcast again.',
      );
    }

    const now = new Date();
    if (pkg.broadcastExpiresAt && pkg.broadcastExpiresAt > now) {
      throw new ConflictException(
        'This delivery is still being broadcast to nearby drivers.',
      );
    }

    const nearbyDrivers = await this.findNearbyAvailableDrivers(
      pkg.pickup,
      pkg.vehicleType,
      pkg.broadcastRadiusKm || DEFAULT_BROADCAST_RADIUS_KM,
    );
    pkg.broadcastDriverIds = nearbyDrivers.map((driver) => driver._id);
    pkg.broadcastedAt = now;
    pkg.broadcastExpiresAt = new Date(now.getTime() + BROADCAST_DURATION_MS);
    pkg.broadcastAttempt = (pkg.broadcastAttempt || 0) + 1;
    await pkg.save();

    this.logger.log(
      `Rebroadcast package ${pkg.trackingNumber} to ${nearbyDrivers.length} nearby drivers`,
    );
    return this.serializeForCustomer(pkg);
  }

  async syncSimulation(packageId: string, user: RequestUser) {
    const pkg = await this.findAuthorizedDocument(packageId, user);
    await this.advanceSimulation(pkg);
    const populated = await this.populatePackage(pkg._id.toString());
    return pkg.customerId.toString() === user._id.toString()
      ? this.serializeForCustomer(populated)
      : this.serializeForDriver(populated);
  }

  async verifyExpressDelivery(
    packageId: string,
    dto: VerifyExpressDeliveryDto,
    user: RequestUser,
  ) {
    const pkg = await this.packageModel.findById(packageId);
    if (!pkg) throw new NotFoundException('Package not found.');
    if (
      user.role !== Role.ADMIN &&
      (!pkg.driverId || pkg.driverId.toString() !== user._id.toString())
    ) {
      throw new ForbiddenException(
        'Only the assigned driver can verify this delivery.',
      );
    }

    const purpose =
      dto.purpose === ExpressVerificationPurpose.PICKUP ? 'pickup' : 'dropoff';
    if (!this.verifySignedToken(packageId, purpose, dto.token)) {
      throw new BadRequestException(
        'The QR code is invalid for this delivery.',
      );
    }

    const now = new Date();
    if (dto.purpose === ExpressVerificationPurpose.PICKUP) {
      if (pkg.status !== BookingStatus.ARRIVED_AT_PICKUP) {
        throw new BadRequestException(
          'The driver must arrive at the pickup before scanning this QR code.',
        );
      }
      pkg.status = BookingStatus.IN_TRANSIT;
      pkg.pickedUpAt = now;
      pkg.simulationDurationSeconds = this.simulationDurationForDistance(
        pkg.deliveryRouteDistanceMeters,
      );
      pkg.simulationProgress = 0;
      pkg.simulationPhaseStartedAt = now;
    } else {
      if (pkg.status !== BookingStatus.ARRIVED_AT_DROPOFF) {
        throw new BadRequestException(
          'The driver must arrive at the recipient before scanning this QR code.',
        );
      }
      pkg.status = BookingStatus.DELIVERED;
      pkg.deliveredAt = now;
      pkg.simulationProgress = 1;
      pkg.simulationPhaseStartedAt = null;
      pkg.payment.status = PaymentStatus.PAID;
    }
    await pkg.save();

    if (pkg.status === BookingStatus.DELIVERED && pkg.driverId) {
      await this.completeDriverTrip(pkg);
    }
    return this.serializeForDriver(await this.populatePackage(packageId));
  }

  async findRecipientTracking(token: string) {
    const packageId = this.packageIdFromSignedToken(token, 'recipient');
    const pkg = await this.populatePackage(packageId);
    await this.advanceSimulation(pkg);
    const refreshed = await this.populatePackage(packageId);
    return this.serializeForRecipient(refreshed, token);
  }

  async updateStatus(
    packageId: string,
    status: BookingStatus,
    user: RequestUser,
  ): Promise<PackageDocument> {
    const pkg = await this.packageModel.findById(packageId);
    if (!pkg) throw new NotFoundException('Package not found');

    if (
      user.role !== Role.ADMIN &&
      (!pkg.driverId || pkg.driverId.toString() !== user._id.toString())
    ) {
      throw new ForbiddenException(
        'You are not authorized to update this package.',
      );
    }

    const allowedStatuses =
      user.role === Role.ADMIN
        ? [
            BookingStatus.PICKED_UP,
            BookingStatus.IN_TRANSIT,
            BookingStatus.DELIVERED,
            BookingStatus.FAILED,
          ]
        : [BookingStatus.FAILED];

    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException(
        `Status ${status} requires the delivery QR workflow.`,
      );
    }

    pkg.status = status;
    if (status === BookingStatus.FAILED) {
      pkg.simulationPhaseStartedAt = null;
    }
    await pkg.save();

    if (status === BookingStatus.DELIVERED && pkg.driverId) {
      await this.completeDriverTrip(pkg);
    } else if (status === BookingStatus.FAILED && pkg.driverId) {
      await this.releaseReservedDriver(pkg.driverId);
    }

    this.logger.log(
      `Package ${pkg.trackingNumber} status updated to ${status}`,
    );
    return pkg;
  }

  private assertOwner(pkg: PackageDocument, user: RequestUser) {
    if (pkg.customerId.toString() !== user._id.toString()) {
      throw new ForbiddenException('You do not have access to this package.');
    }
  }

  private assertPending(pkg: PackageDocument, action: string) {
    if (pkg.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Cannot ${action} a package with status "${pkg.status}".`,
      );
    }
  }

  private async paginatedQuery(filter: object, query: QueryBookingDto) {
    const { page = 1, limit = 10, status, vehicleType, trackingNumber } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = { ...filter };
    if (status) where.status = status;
    if (vehicleType) where.vehicleType = vehicleType;
    if (trackingNumber) where.trackingNumber = trackingNumber.toUpperCase();

    const [data, total] = await Promise.all([
      this.packageModel
        .find(where)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customerId', 'name email phone avatarUrl')
        .populate('driverId', 'name email phone isOnline currentLocation')
        .exec(),
      this.packageModel.countDocuments(where),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
      },
    };
  }

  private assertExpressVehicle(vehicleType: VehicleType): void {
    if (
      vehicleType !== VehicleType.MOTORCYCLE &&
      vehicleType !== VehicleType.RICKSHAW
    ) {
      throw new BadRequestException(
        'Express delivery currently supports MOTORCYCLE or RICKSHAW only.',
      );
    }
  }

  private assertExpressCapacity(dto: CreateBookingDto): void {
    const maxWeightKg = dto.vehicleType === VehicleType.MOTORCYCLE ? 20 : 150;
    const maxPackages = dto.vehicleType === VehicleType.MOTORCYCLE ? 5 : 30;
    if ((dto.package.weightKg ?? 0) > maxWeightKg) {
      throw new BadRequestException(
        `${dto.vehicleType} supports up to ${maxWeightKg} kg for express delivery.`,
      );
    }
    if (dto.package.quantity > maxPackages) {
      throw new BadRequestException(
        `${dto.vehicleType} supports up to ${maxPackages} packages per express delivery.`,
      );
    }
  }

  private assertInsidePhnomPenh(coordinate: Coordinate, label: string): void {
    const distance = haversineKm(
      PHNOM_PENH_CENTER.latitude,
      PHNOM_PENH_CENTER.longitude,
      coordinate.latitude,
      coordinate.longitude,
    );
    if (distance > EXPRESS_SERVICE_RADIUS_KM) {
      throw new BadRequestException(
        `${label} must be inside the Phnom Penh express-delivery area.`,
      );
    }
  }

  private async findNearbyAvailableDrivers(
    pickup: Coordinate,
    vehicleType: VehicleType,
    radiusKm: number,
  ): Promise<UserDocument[]> {
    const acceptedTypes =
      vehicleType === VehicleType.RICKSHAW
        ? [VehicleType.RICKSHAW, VehicleType.CAR]
        : [VehicleType.MOTORCYCLE];
    const drivers = await this.userModel
      .find({
        role: Role.DRIVER,
        isActive: true,
        availabilityStatus: DriverAvailabilityStatus.AVAILABLE,
        'driverProfile.isOnline': true,
        'driverProfile.currentLocation': { $ne: null },
        $or: [
          { vehicleType: { $in: acceptedTypes } },
          { 'driverProfile.vehicleType': { $in: acceptedTypes } },
          { supportedVehicleTypes: { $in: acceptedTypes } },
        ],
      })
      .exec();
    return drivers.filter((driver) => {
      if (!this.driverSupportsRequest(driver, vehicleType)) return false;
      const location = driver.driverProfile?.currentLocation;
      if (!location) return false;
      return (
        haversineKm(
          pickup.latitude,
          pickup.longitude,
          location.lat,
          location.lng,
        ) <= radiusKm
      );
    });
  }

  private async getAvailableExpressDriver(
    driverId: string,
  ): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(driverId)) {
      throw new BadRequestException('Invalid driver ID.');
    }
    const driver = await this.userModel.findById(driverId).exec();
    if (!driver || driver.role !== Role.DRIVER || !driver.isActive) {
      throw new ForbiddenException('An active driver account is required.');
    }
    if (
      !driver.driverProfile?.isOnline ||
      !driver.driverProfile.currentLocation ||
      driver.availabilityStatus !== DriverAvailabilityStatus.AVAILABLE
    ) {
      throw new ForbiddenException(
        'Go online and become available before receiving delivery requests.',
      );
    }
    return driver;
  }

  private compatibleRequestVehicleTypes(driver: UserDocument): VehicleType[] {
    const types = new Set<VehicleType>();
    const add = (value: string | null | undefined) => {
      if (value === VehicleType.MOTORCYCLE) {
        types.add(VehicleType.MOTORCYCLE);
      }
      if (value === VehicleType.RICKSHAW || value === VehicleType.CAR) {
        types.add(VehicleType.RICKSHAW);
      }
    };
    add(driver.vehicleType ?? driver.driverProfile?.vehicleType);
    driver.supportedVehicleTypes?.forEach(add);
    return [...types];
  }

  private driverSupportsRequest(
    driver: UserDocument,
    vehicleType: VehicleType,
  ): boolean {
    return this.compatibleRequestVehicleTypes(driver).includes(vehicleType);
  }

  private async findAuthorizedDocument(
    packageId: string,
    user: RequestUser,
  ): Promise<PackageDocument> {
    if (!Types.ObjectId.isValid(packageId)) {
      throw new BadRequestException('Invalid package ID.');
    }
    const pkg = await this.packageModel.findById(packageId);
    if (!pkg) throw new NotFoundException('Package not found.');
    const isOwner = pkg.customerId.toString() === user._id.toString();
    const isDriver = pkg.driverId?.toString() === user._id.toString();
    if (user.role !== Role.ADMIN && !isOwner && !isDriver) {
      throw new ForbiddenException('You do not have access to this delivery.');
    }
    return pkg;
  }

  private async populatePackage(packageId: string): Promise<PackageDocument> {
    const pkg = await this.packageModel
      .findById(packageId)
      .populate('customerId', 'name phone avatarUrl')
      .populate('driverId', 'name phone avatarUrl vehicleType driverProfile')
      .exec();
    if (!pkg) throw new NotFoundException('Package not found.');
    return pkg;
  }

  private async advanceSimulation(
    pkg: PackageDocument,
  ): Promise<PackageDocument> {
    const isPickupLeg = pkg.status === BookingStatus.ACCEPTED;
    const isDeliveryLeg = pkg.status === BookingStatus.IN_TRANSIT;
    if (!isPickupLeg && !isDeliveryLeg) return pkg;
    if (!pkg.simulationPhaseStartedAt) return pkg;

    const durationSeconds = Math.max(pkg.simulationDurationSeconds || 30, 1);
    const elapsedSeconds =
      (Date.now() - pkg.simulationPhaseStartedAt.getTime()) / 1000;
    pkg.simulationProgress = Math.min(1, elapsedSeconds / durationSeconds);
    if (pkg.simulationProgress >= 1) {
      const now = new Date();
      if (isPickupLeg) {
        pkg.status = BookingStatus.ARRIVED_AT_PICKUP;
        pkg.arrivedAtPickupAt = now;
      } else {
        pkg.status = BookingStatus.ARRIVED_AT_DROPOFF;
        pkg.arrivedAtDropoffAt = now;
      }
      pkg.simulationProgress = 1;
      pkg.simulationPhaseStartedAt = null;
    }
    await pkg.save();
    return pkg;
  }

  private async completeDriverTrip(pkg: PackageDocument): Promise<void> {
    if (!pkg.driverId) return;
    const driver = await this.userModel.findById(pkg.driverId);
    if (!driver) return;
    const earnings = (pkg.estimatedPrice || 0) * 0.95;
    if (driver.driverProfile) {
      driver.driverProfile.balance += earnings;
      driver.driverProfile.isOnline = true;
      driver.markModified('driverProfile');
    }
    driver.availabilityStatus = DriverAvailabilityStatus.AVAILABLE;
    await driver.save();
    this.logger.log(
      `Added ${earnings} to driver ${driver._id} and made the driver available.`,
    );
  }

  private simulationDurationForDistance(
    distanceMeters: number | null | undefined,
  ): number {
    if (!distanceMeters || distanceMeters <= 0) {
      return MIN_SIMULATION_DURATION_SECONDS;
    }
    const metersPerSecond = (EXPRESS_SIMULATION_SPEED_KMH * 1000) / 3600;
    return Math.min(
      MAX_SIMULATION_DURATION_SECONDS,
      Math.max(
        MIN_SIMULATION_DURATION_SECONDS,
        Math.round(distanceMeters / metersPerSecond),
      ),
    );
  }

  private async releaseReservedDriver(driverId: Types.ObjectId): Promise<void> {
    await this.userModel.updateOne(
      {
        _id: driverId,
        availabilityStatus: DriverAvailabilityStatus.ON_TRIP,
      },
      { $set: { availabilityStatus: DriverAvailabilityStatus.AVAILABLE } },
    );
  }

  private serializeForCustomer(pkg: PackageDocument) {
    const value = pkg.toObject();
    delete value.broadcastDriverIds;
    const packageId = pkg._id.toString();
    return {
      ...value,
      pickupQrToken: this.createSignedToken(packageId, 'pickup'),
      recipientTrackingToken: this.createSignedToken(packageId, 'recipient'),
    };
  }

  private serializeForDriver(pkg: PackageDocument) {
    const value = pkg.toObject();
    delete value.broadcastDriverIds;
    return value;
  }

  private serializeForRecipient(pkg: PackageDocument, recipientToken: string) {
    const trackingEnabled = [
      BookingStatus.IN_TRANSIT,
      BookingStatus.ARRIVED_AT_DROPOFF,
      BookingStatus.DELIVERED,
    ].includes(pkg.status);
    const driver =
      pkg.driverId && typeof pkg.driverId === 'object'
        ? (pkg.driverId as unknown as {
            name?: string;
            phone?: string;
            avatarUrl?: string;
            vehicleType?: string;
          })
        : null;
    return {
      _id: pkg._id,
      trackingNumber: pkg.trackingNumber,
      status: pkg.status,
      trackingEnabled,
      vehicleType: pkg.vehicleType,
      package: {
        name: pkg.package.name,
        type: pkg.package.type,
        quantity: pkg.package.quantity,
      },
      pickup: {
        address: pkg.pickup.address,
        latitude: trackingEnabled ? pkg.pickup.latitude : null,
        longitude: trackingEnabled ? pkg.pickup.longitude : null,
      },
      dropoff: pkg.dropoff,
      driver: trackingEnabled ? driver : null,
      routePoints: trackingEnabled ? pkg.deliveryRoutePoints : [],
      routeDurationSeconds: trackingEnabled
        ? pkg.deliveryRouteDurationSeconds
        : null,
      simulationDurationSeconds: pkg.simulationDurationSeconds,
      simulationProgress: trackingEnabled ? pkg.simulationProgress : 0,
      simulationPhaseStartedAt: trackingEnabled
        ? pkg.simulationPhaseStartedAt
        : null,
      recipientTrackingToken: recipientToken,
      dropoffQrToken:
        pkg.status === BookingStatus.ARRIVED_AT_DROPOFF
          ? this.createSignedToken(pkg._id.toString(), 'dropoff')
          : null,
    };
  }

  private createSignedToken(packageId: string, purpose: string): string {
    const signature = createHmac('sha256', this.tokenSecret())
      .update(`${purpose}:${packageId}`)
      .digest('base64url');
    return `${packageId}.${signature}`;
  }

  private verifySignedToken(
    packageId: string,
    purpose: string,
    token: string,
  ): boolean {
    const expected = this.createSignedToken(packageId, purpose);
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(token);
    return (
      expectedBuffer.length === actualBuffer.length &&
      timingSafeEqual(expectedBuffer, actualBuffer)
    );
  }

  private packageIdFromSignedToken(token: string, purpose: string): string {
    const packageId = token.split('.', 1)[0];
    if (
      !Types.ObjectId.isValid(packageId) ||
      !this.verifySignedToken(packageId, purpose, token)
    ) {
      throw new ForbiddenException('The recipient tracking token is invalid.');
    }
    return packageId;
  }

  private tokenSecret(): string {
    return (
      this.configService.get<string>('jwt.secret') ??
      'dev_secret_replace_in_production'
    );
  }

  private async triggerAutoMapping(pkg: PackageDocument) {
    const url = this.configService.get<string>('ETA_API_URL');
    const apiKey = this.configService.get<string>('ETA_API_KEY');

    if (!url || !apiKey) {
      this.logger.warn('FastAPI URL or API Key missing, skipping automapping');
      return;
    }

    const payload = {
      accept_time: new Date().toISOString(),
      stops: [
        {
          order_id: pkg._id.toString(),
          accept_gps_lat: pkg.pickup.latitude,
          accept_gps_lng: pkg.pickup.longitude,
          delivery_gps_lat: pkg.dropoff.latitude,
          delivery_gps_lng: pkg.dropoff.longitude,
          accept_time: new Date().toISOString(),
        },
      ],
      drivers: [],
    };

    try {
      const response = await fetch(`${url}/autoMaping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(`FastAPI Error (${response.status}): ${errText}`);
        return;
      }

      const result = await response.json();
      this.logger.log(`FastAPI AutoMapping Result: ${JSON.stringify(result)}`);
    } catch (error: any) {
      this.logger.error(`Failed to call FastAPI AutoMapping: ${error.message}`);
    }
  }

  private async notifyAcceptance(pkg: PackageDocument, driverId: string) {
    const url = this.configService.get<string>('ETA_API_URL');
    const apiKey = this.configService.get<string>('ETA_API_KEY');

    if (!url || !apiKey) return;

    const payload = {
      order_id: pkg._id.toString(),
      driver_id: driverId,
      timestamp: new Date().toISOString(),
    };

    try {
      await fetch(`${url}/accept_delivery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to notify FastAPI about acceptance: ${error.message}`,
      );
    }
  }
}
