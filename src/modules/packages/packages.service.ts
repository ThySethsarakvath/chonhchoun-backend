import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';

import {
  Package,
  PackageDocument,
} from '../../shared/schemas/package.schema';
import { User, UserDocument } from '../../shared/schemas/user.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto, CancelBookingDto } from './dto/update-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import { BookingStatus, PaymentStatus } from '../../common/enum/package.enum';
import { haversineKm, estimatePrice } from '../../common/utils/pricing.util';
import { generateTrackingNumber } from '../../common/utils/tracking.util';
import { normalisePhone } from '../../common/utils/phone.util';
import { Role } from '../../common/enum/role.enum';

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
  ) {}

  async create(dto: CreateBookingDto, user: RequestUser): Promise<PackageDocument> {
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

    const distanceKm = haversineKm(
      pickup.latitude,
      pickup.longitude,
      dropoff.latitude,
      dropoff.longitude,
    );
    const estimatedPrice = estimatePrice(distanceKm, dto.vehicleType);

    if (dto.scheduledAt) {
      const scheduled = new Date(dto.scheduledAt);
      if (scheduled <= new Date()) {
        throw new BadRequestException('scheduledAt must be a future date and time.');
      }
    }

    const pkg = await this.packageModel.create({
      trackingNumber: generateTrackingNumber(),
      customerId: user._id,
      vehicleType: dto.vehicleType,
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
    });

    this.logger.log(
      `Package created: ${pkg.trackingNumber} by user ${user._id}`,
    );
    this.logger.log(`Created booking ID: ${pkg._id}`);

    // Trigger AI mapping in background safely
    this.triggerAutoMapping(pkg).catch(err => 
      this.logger.error(`AutoMapping Trigger Error (Async): ${err.message}`)
    );

    return pkg;
  }

  async findMyBookings(userId: string, query: QueryBookingDto) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    return this.paginatedQuery({ customerId: new Types.ObjectId(userId) }, query);
  }

  async findOne(id: string, user: RequestUser): Promise<PackageDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid package ID format.');
    }

    const pkg = await this.packageModel
      .findById(id)
      .populate('customerId', 'name email phone')
      .exec();

    if (!pkg) throw new NotFoundException('Package not found.');

    if (
      user.role !== Role.ADMIN &&
      pkg.customerId.toString() !== user._id.toString()
    ) {
      throw new ForbiddenException('You do not have access to this package.');
    }

    return pkg;
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
    if (dto.payment) pkg.payment = { ...pkg.payment, ...dto.payment, amount: estimatedPrice };
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

  async findAvailable(): Promise<PackageDocument[]> {
    return this.packageModel.find({ status: BookingStatus.PENDING }).exec();
  }

  async acceptPackage(packageId: string, driverId: any): Promise<PackageDocument> {
    const pkg = await this.packageModel.findById(packageId);
    if (!pkg) throw new NotFoundException('Package not found');

    const driverObjectId = typeof driverId === 'string' ? new Types.ObjectId(driverId) : driverId;

    pkg.status = BookingStatus.ACCEPTED;
    pkg.driverId = driverObjectId;
    await pkg.save();

    // Notify FastAPI
    this.notifyAcceptance(pkg, driverId.toString()).catch(err => 
      this.logger.error(`FastAPI Acceptance Notification Error: ${err.message}`)
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

  private async triggerAutoMapping(pkg: PackageDocument) {
    const url = this.configService.get<string>('ETA_API_URL');
    const apiKey = this.configService.get<string>('ETA_API_KEY');

    if (!url || !apiKey) {
      this.logger.warn('FastAPI URL or API Key missing, skipping automapping');
      return;
    }

    const payload = {
      accept_time: new Date().toISOString(),
      stops: [{
        order_id: pkg._id.toString(),
        accept_gps_lat: pkg.pickup.latitude,
        accept_gps_lng: pkg.pickup.longitude,
        delivery_gps_lat: pkg.dropoff.latitude,
        delivery_gps_lng: pkg.dropoff.longitude,
        accept_time: new Date().toISOString()
      }],
      drivers: [] 
    };

    try {
      const response = await fetch(`${url}/autoMaping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
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
      timestamp: new Date().toISOString()
    };

    try {
      await fetch(`${url}/accept_delivery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });
    } catch (error: any) {
      this.logger.error(`Failed to notify FastAPI about acceptance: ${error.message}`);
    }
  }
}
