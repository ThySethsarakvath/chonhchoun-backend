import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AdminActivity,
  AdminActivityDocument,
} from '../../shared/schemas/admin-activity.schema';

interface LogActivityInput {
  action: string;
  actor?: { _id?: Types.ObjectId | string; name?: string };
  targetUser?: { _id?: Types.ObjectId | string; name?: string };
  branch?: {
    _id?: Types.ObjectId | string;
    name?: string;
    branchNumber?: number;
  };
  details?: string;
}

@Injectable()
export class AdminActivityService {
  constructor(
    @InjectModel(AdminActivity.name)
    private readonly adminActivityModel: Model<AdminActivityDocument>,
  ) {}

  async log(input: LogActivityInput) {
    return this.adminActivityModel.create({
      action: input.action,
      actorId: input.actor?._id,
      actorName: input.actor?.name ?? 'Admin',
      targetUserId: input.targetUser?._id,
      targetUserName: input.targetUser?.name,
      branchId: input.branch?._id,
      branchName: input.branch?.name,
      branchNumber: input.branch?.branchNumber,
      details: input.details,
    });
  }

  async findRecent(limit = 50) {
    return this.adminActivityModel
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}
