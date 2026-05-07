import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { promises as fs } from 'fs';
import { Model } from 'mongoose';
import { join } from 'path';
import { Role } from '../../common/enum/role.enum';
import { User, UserDocument } from '../../shared/schemas/user.schema';
import { CloudinaryService } from '../database/cloudinary/cloudinary.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

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

  async updateMyAvatar(
    userId: string,
    file: Express.Multer.File | undefined,
    baseUrl: string,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    const avatarUrl = this.isCloudinaryConfigured()
      ? await this.uploadAvatarToCloudinary(file)
      : await this.uploadAvatarToDisk(file, baseUrl);

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { avatarUrl },
      { new: true },
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.redisService.saveUserSession(user._id.toString(), {
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: String(user.isActive),
      avatarUrl: user.avatarUrl ?? '',
    });

    return {
      message: 'Avatar updated successfully',
      user: this.toSafeUser(user),
    };
  }

  private async uploadAvatarToCloudinary(
    file: Express.Multer.File,
  ): Promise<string> {
    const result = await this.cloudinaryService.uploadImage(file, 'avatars');
    return result.url;
  }

  private async uploadAvatarToDisk(
    file: Express.Multer.File,
    baseUrl: string,
  ): Promise<string> {
    const uploadsDir = join(process.cwd(), 'uploads', 'avatars');
    await fs.mkdir(uploadsDir, { recursive: true });

    const extension = this.extensionFromMimeType(file.mimetype);
    const fileName = `avatar-${Date.now()}-${Math.round(
      Math.random() * 1e9,
    )}.${extension}`;
    const filePath = join(uploadsDir, fileName);

    if (file.buffer) {
      await fs.writeFile(filePath, file.buffer);
    } else if (file.path) {
      const fileContent = await fs.readFile(file.path);
      await fs.writeFile(filePath, fileContent);
    } else {
      throw new BadRequestException('Unable to process uploaded file.');
    }

    return `${baseUrl}/uploads/avatars/${fileName}`;
  }

  private extensionFromMimeType(mimeType: string): string {
    switch (mimeType) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      default:
        throw new BadRequestException(
          'Invalid file type. Only jpg, jpeg, png, and webp are allowed.',
        );
    }
  }

  private isCloudinaryConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('cloudinary.cloudName') &&
      this.configService.get<string>('cloudinary.apiKey') &&
      this.configService.get<string>('cloudinary.apiSecret'),
    );
  }

  private toSafeUser(user: UserDocument) {
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: (user as any).createdAt,
      updatedAt: (user as any).updatedAt,
    };
  }
}
