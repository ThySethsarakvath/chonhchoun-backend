import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Package,
  PackageDocument,
} from '../../shared/schemas/package.schema';
import { PackageStatus } from 'src/common/enum/package.enum';
import {
  CreatePackageDto,
  UpdatePackageDto,
  ListPackagesQueryDto,
} from './dto/create-package.dto';

@Injectable()
export class PackagesService {
  private readonly logger = new Logger(PackagesService.name);

  constructor(
    @InjectModel(Package.name)
    private readonly packageModel: Model<PackageDocument>,
  ) {}

  async create(
    senderId: string,
    dto: CreatePackageDto,
  ): Promise<PackageDocument> {
    // Validate senderId is a valid MongoDB ObjectId
    if (!Types.ObjectId.isValid(senderId)) {
      throw new BadRequestException('Invalid sender ID');
    }

    // Validate location data (latitude/longitude are within valid ranges)
    this.validateCoordinates(
      dto.pickup.location.latitude,
      dto.pickup.location.longitude,
    );
    this.validateCoordinates(
      dto.dropoff.location.latitude,
      dto.dropoff.location.longitude,
    );

    // Validate pickup time is in the future
    if (new Date(dto.pickup.scheduledAt) < new Date()) {
      throw new BadRequestException(
        'Pickup scheduled time must be in the future',
      );
    }

    try {
      const newPackage = await this.packageModel.create({
        senderId: new Types.ObjectId(senderId),
        vehicleType: dto.vehicleType,
        items: dto.items,
        pickup: {
          location: dto.pickup.location,
          contact: dto.pickup.contact,
          scheduledAt: new Date(dto.pickup.scheduledAt),
          actualPickupAt: null,
        },
        dropoff: {
          location: dto.dropoff.location,
          contact: dto.dropoff.contact,
          estimatedDeliveryAt: null,
          actualDeliveryAt: null,
        },
        payment: {
          payer: dto.payment.payer,
          method: dto.payment.method,
          estimatedCost: dto.payment.estimatedCost || null,
          actualCost: null,
          isPaid: false,
        },
        status: PackageStatus.DRAFT,
        assignedDriverId: null,
        notes: dto.notes || null,
      });

      this.logger.log(`Package created: ${newPackage._id} by user ${senderId}`);
      return newPackage;
    } catch (error) {
      this.logger.error(`Failed to create package: ${(error as Error).message}`);
      throw new BadRequestException('Failed to create package');
    }
  }


  async findAll(
    senderId: string,
    query: ListPackagesQueryDto,
  ): Promise<{ data: PackageDocument[]; total: number; page: number }> {
    if (!Types.ObjectId.isValid(senderId)) {
      throw new BadRequestException('Invalid sender ID');
    }

    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = { senderId: new Types.ObjectId(senderId) };

    if (query.status) {
      if (!Object.values(PackageStatus).includes(query.status as PackageStatus)) {
        throw new BadRequestException(`Invalid status: ${query.status}`);
      }
      filter.status = query.status;
    }

    // Build sort
    const sortOptions: any = {};
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.order === 'asc' ? 1 : -1;
    sortOptions[sortField] = sortOrder;

    try {
      const [data, total] = await Promise.all([
        this.packageModel
          .find(filter)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.packageModel.countDocuments(filter),
      ]);

      return { data, total, page };
    } catch (error) {
      this.logger.error(`Failed to fetch packages: ${(error as Error).message}`);
      throw new BadRequestException('Failed to fetch packages');
    }
  }

  /**
   * Get a single package by ID
   * Only the sender can view their package
   */
  async findOne(packageId: string, senderId: string): Promise<PackageDocument> {
    if (!Types.ObjectId.isValid(packageId)) {
      throw new BadRequestException('Invalid package ID');
    }

    const pkg = await this.packageModel.findById(packageId).exec();

    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    // Authorization: only sender can view their package
    if (pkg.senderId.toString() !== senderId) {
      throw new ForbiddenException(
        'You do not have permission to view this package',
      );
    }

    return pkg;
  }

  async update(
    packageId: string,
    senderId: string,
    dto: UpdatePackageDto,
  ): Promise<PackageDocument> {
    if (!Types.ObjectId.isValid(packageId)) {
      throw new BadRequestException('Invalid package ID');
    }

    const pkg = await this.packageModel.findById(packageId).exec();

    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    // Authorization: only sender can update their package
    if (pkg.senderId.toString() !== senderId) {
      throw new ForbiddenException(
        'You do not have permission to update this package',
      );
    }

    // Only allow updates in DRAFT status
    if (pkg.status !== PackageStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot update package in ${pkg.status} status. Only DRAFT packages can be edited.`,
      );
    }

    // Validate coordinates if location is being updated
    if (dto.pickup?.location) {
      this.validateCoordinates(
        dto.pickup.location.latitude,
        dto.pickup.location.longitude,
      );
    }
    if (dto.dropoff?.location) {
      this.validateCoordinates(
        dto.dropoff.location.latitude,
        dto.dropoff.location.longitude,
      );
    }

    // Validate pickup time if being updated
    if (dto.pickup?.scheduledAt) {
      if (new Date(dto.pickup.scheduledAt) < new Date()) {
        throw new BadRequestException(
          'Pickup scheduled time must be in the future',
        );
      }
    }

    // Build update object
    const updates: any = {};

    if (dto.vehicleType) updates.vehicleType = dto.vehicleType;
    if (dto.items) updates.items = dto.items;
    if (dto.notes !== undefined) updates.notes = dto.notes;

    if (dto.pickup) {
      const pickupObj = pkg.pickup as any;
      updates.pickup = {
        ...pickupObj,
        ...dto.pickup,
      };
    }

    if (dto.dropoff) {
      const dropoffObj = pkg.dropoff as any;
      updates.dropoff = {
        ...dropoffObj,
        ...dto.dropoff,
      };
    }

    if (dto.payment) {
      const paymentObj = pkg.payment as any;
      updates.payment = {
        ...paymentObj,
        ...dto.payment,
      };
    }

    try {
      const updated = await this.packageModel
        .findByIdAndUpdate(packageId, updates, { new: true })
        .exec();

      this.logger.log(
        `Package updated: ${packageId} by user ${senderId}`,
      );
      return updated!;
    } catch (error) {
      this.logger.error(`Failed to update package: ${(error as Error).message}`);
      throw new BadRequestException('Failed to update package');
    }
  }

  async remove(packageId: string, senderId: string): Promise<void> {
    if (!Types.ObjectId.isValid(packageId)) {
      throw new BadRequestException('Invalid package ID');
    }

    const pkg = await this.packageModel.findById(packageId).exec();

    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    // Authorization: only sender can delete their package
    if (pkg.senderId.toString() !== senderId) {
      throw new ForbiddenException(
        'You do not have permission to delete this package',
      );
    }

    // Only allow deletion in DRAFT status
    if (pkg.status !== PackageStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot delete package in ${pkg.status} status. Only DRAFT packages can be deleted.`,
      );
    }

    try {
      await this.packageModel.findByIdAndDelete(packageId).exec();
      this.logger.log(
        `Package deleted: ${packageId} by user ${senderId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to delete package: ${(error as Error).message}`);
      throw new BadRequestException('Failed to delete package');
    }
  }

  async submitForDelivery(
    packageId: string,
    senderId: string,
  ): Promise<PackageDocument> {
    if (!Types.ObjectId.isValid(packageId)) {
      throw new BadRequestException('Invalid package ID');
    }

    const pkg = await this.packageModel.findById(packageId).exec();

    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    if (pkg.senderId.toString() !== senderId) {
      throw new ForbiddenException(
        'You do not have permission to submit this package',
      );
    }

    if (pkg.status !== PackageStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot submit package in ${pkg.status} status. Only DRAFT packages can be submitted.`,
      );
    }

    try {
      const updated = await this.packageModel
        .findByIdAndUpdate(
          packageId,
          { status: PackageStatus.PENDING },
          { new: true },
        )
        .exec();

      this.logger.log(
        `Package submitted for delivery: ${packageId} by user ${senderId}`,
      );
      return updated!;
    } catch (error) {
      this.logger.error(`Failed to submit package: ${(error as Error).message}`);
      throw new BadRequestException('Failed to submit package');
    }
  }

  /**
   * Cancel a package (return from PENDING to DRAFT or to CANCELLED)
   */
  async cancel(packageId: string, senderId: string): Promise<PackageDocument> {
    if (!Types.ObjectId.isValid(packageId)) {
      throw new BadRequestException('Invalid package ID');
    }

    const pkg = await this.packageModel.findById(packageId).exec();

    if (!pkg) {
      throw new NotFoundException('Package not found');
    }

    if (pkg.senderId.toString() !== senderId) {
      throw new ForbiddenException(
        'You do not have permission to cancel this package',
      );
    }

    // Can only cancel DRAFT or PENDING packages
    if (![PackageStatus.DRAFT, PackageStatus.PENDING].includes(pkg.status)) {
      throw new BadRequestException(
        `Cannot cancel package in ${pkg.status} status.`,
      );
    }

    try {
      const updated = await this.packageModel
        .findByIdAndUpdate(
          packageId,
          { status: PackageStatus.CANCELLED },
          { new: true },
        )
        .exec();

      this.logger.log(
        `Package cancelled: ${packageId} by user ${senderId}`,
      );
      return updated!;
    } catch (error) {
      this.logger.error(`Failed to cancel package: ${(error as Error).message}`);
      throw new BadRequestException('Failed to cancel package');
    }
  }

  private validateCoordinates(latitude: number, longitude: number): void {
    if (latitude < -90 || latitude > 90) {
      throw new BadRequestException(
        'Latitude must be between -90 and 90 degrees',
      );
    }
    if (longitude < -180 || longitude > 180) {
      throw new BadRequestException(
        'Longitude must be between -180 and 180 degrees',
      );
    }
  }
}
