import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../shared/schemas/user.schema';
import { Role } from '../../common/enum/role.enum';
import { normalisePhone } from 'src/common/utils/phone.util';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CloudinaryService } from '../database/cloudinary/cloudinary.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { DriverAvailabilityStatus } from '../../common/enum/driver-availability-status.enum';
import { VehicleType } from '../../common/enum/package.enum';
import {
  DriverVehicleAssignment,
  DriverVehicleAssignmentDocument,
} from '../../shared/schemas/driver-vehicle-assignment.schema';
import { Vehicle, VehicleDocument } from '../../shared/schemas/vehicle.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Vehicle.name)
    private readonly vehicleModel: Model<VehicleDocument>,
    @InjectModel(DriverVehicleAssignment.name)
    private readonly assignmentModel: Model<DriverVehicleAssignmentDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  private normalizeVehicleType(
    vehicleType: string | null | undefined,
  ): string | null {
    if (!vehicleType) return null;
    return vehicleType === 'TRUCK_SMALL' ? 'TRUCK' : vehicleType;
  }

  async findAll() {
    return this.userModel.find().exec();
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getDriverState(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const activeAssignment = await this.assignmentModel
      .findOne({ driverId: user._id, isActive: true })
      .sort({ assignedAt: -1 })
      .exec();

    let vehicle: VehicleDocument | null = null;
    if (activeAssignment?.vehicleId) {
      vehicle = await this.vehicleModel
        .findById(activeAssignment.vehicleId)
        .exec();
    } else if (user.assignedVehicleCode) {
      vehicle = await this.vehicleModel
        .findOne({
          code: user.assignedVehicleCode,
        })
        .exec();
    }

    return {
      profile: this.sanitize(user),
      currentVehicle: vehicle
        ? {
            _id: vehicle._id,
            code: vehicle.code,
            plateNumber: vehicle.plateNumber ?? null,
            type: this.normalizeVehicleType(vehicle.type),
            ownershipType: vehicle.ownershipType,
            status: vehicle.status,
            isActive: vehicle.isActive,
            maxWeightKg: vehicle.maxWeightKg ?? null,
            maxPackageCount: vehicle.maxPackageCount ?? null,
          }
        : null,
      activeAssignment: activeAssignment
        ? {
            _id: activeAssignment._id,
            assignmentType: activeAssignment.assignmentType,
            assignedAt: activeAssignment.assignedAt,
          }
        : null,
    };
  }

  async updateDriverAvailabilityStatus(
    userId: string,
    availabilityStatus: DriverAvailabilityStatus,
  ) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    if (user.role !== Role.DRIVER) {
      throw new BadRequestException(
        'Availability status can only be updated for driver accounts.',
      );
    }

    user.availabilityStatus = availabilityStatus;
    await user.save();

    return this.sanitize(user);
  }

  async findByRole(role: Role) {
    return this.userModel.find({ role }).exec();
  }

  async deactivate(id: string) {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateDriverVehicleType(userId: string, vehicleType: VehicleType) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id.');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    if (user.role !== Role.DRIVER) {
      throw new BadRequestException(
        'Vehicle type can only be assigned to driver accounts.',
      );
    }

    user.vehicleType = vehicleType;
    await user.save();

    return this.sanitize(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updates: Partial<User> = {};
    if (dto.name) updates.name = dto.name.trim();
    if (dto.phone) {
      const phone = normalisePhone(dto.phone);
      const taken = await this.userModel.findOne({
        phone,
        _id: { $ne: userId },
      });
      if (taken) throw new ConflictException('Phone number already in use.');
      updates.phone = phone;
    }
    const user = await this.userModel.findByIdAndUpdate(userId, updates, {
      new: true,
    });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitize(user);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Image file is required.');
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    // Delete old avatar from Cloudinary if one exists
    if (user.avatarPublicId) {
      await this.cloudinaryService.deleteImage(user.avatarPublicId);
    }
    // Upload new avatar — stored under chonhchoun/avatars/
    const { url, publicId } = await this.cloudinaryService.uploadImage(
      file,
      'chonhchoun/avatars',
    );
    const updated = await this.userModel.findByIdAndUpdate(
      userId,
      { avatarUrl: url, avatarPublicId: publicId },
      { new: true },
    );
    return this.sanitize(updated!);
  }

  async removeAvatar(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.avatarPublicId) {
      await this.cloudinaryService.deleteImage(user.avatarPublicId);
    }
    await this.userModel.findByIdAndUpdate(userId, {
      avatarUrl: null,
      avatarPublicId: null,
    });
    return { message: 'Avatar removed successfully.' };
  }

  sanitize(user: UserDocument) {
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      vehicleType: this.normalizeVehicleType(user.vehicleType),
      assignedVehicleCode: user.assignedVehicleCode ?? null,
      availabilityStatus:
        user.availabilityStatus ?? DriverAvailabilityStatus.OFFLINE,
      supportedVehicleTypes:
        user.supportedVehicleTypes?.map((type) =>
          this.normalizeVehicleType(type),
        ) ?? [],
      licenseNumber: user.licenseNumber ?? null,
      licenseExpiry: user.licenseExpiry ?? null,
      maxLoadWeightKg: user.maxLoadWeightKg ?? null,
      maxPackageCount: user.maxPackageCount ?? null,
      isActive: user.isActive,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: (user as any).createdAt,
      updatedAt: (user as any).updatedAt,
    };
  }
}
