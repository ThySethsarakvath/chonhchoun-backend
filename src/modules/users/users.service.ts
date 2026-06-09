import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../shared/schemas/user.schema';
import { Role } from '../../common/enum/role.enum';
import { normalisePhone } from 'src/common/utils/phone.util';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CloudinaryService } from '../database/cloudinary/cloudinary.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { VehicleType } from '../../common/enum/package.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
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
      isActive: user.isActive,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: (user as any).createdAt,
      updatedAt: (user as any).updatedAt,
    };
  }
}
