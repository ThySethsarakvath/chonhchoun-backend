import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../shared/schemas/user.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findAllUsers() {
    const users = await this.userModel.find().sort({ createdAt: -1 }).exec();
    return users.map((user) => this.toAdminUser(user));
  }

  private toAdminUser(user: UserDocument) {
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: (user as any).createdAt,
    };
  }
}
