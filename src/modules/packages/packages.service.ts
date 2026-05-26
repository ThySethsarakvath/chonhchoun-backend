import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

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
    return pkg;
  }

  async findMyBookings(userId: string, query: QueryBookingDto) {
    return this.paginatedQuery({ customerId: new Types.ObjectId(userId) }, query);
  }

  async findOne(id: string, user: RequestUser): Promise<PackageDocument> {
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
}