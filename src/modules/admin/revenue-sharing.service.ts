import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  RevenueSharingConfig,
  RevenueSharingConfigDocument,
} from '../../shared/schemas/revenue-sharing-config.schema';
import { UpdateRevenueSharingDto } from './dto/update-revenue-sharing.dto';
import { AdminActivityService } from './admin-activity.service';

@Injectable()
export class RevenueSharingService {
  constructor(
    @InjectModel(RevenueSharingConfig.name)
    private readonly revenueSharingModel: Model<RevenueSharingConfigDocument>,
    private readonly adminActivityService: AdminActivityService,
  ) {}

  private validatePercentages(sender: number, receiver: number, company: number) {
    const total = sender + receiver + company;
    if (total !== 100) {
      throw new BadRequestException(
        'Revenue sharing percentages must total exactly 100.',
      );
    }
  }

  async getCurrentConfig() {
    let config = await this.revenueSharingModel
      .findOne({ isActive: true })
      .sort({ version: -1 })
      .exec();

    if (!config) {
      config = await this.revenueSharingModel.create({
        version: 1,
        senderBranchPercent: 10,
        receiverBranchPercent: 10,
        companyPercent: 80,
        isActive: true,
        note: 'Default company revenue-sharing rule',
      });
    }

    return config;
  }

  async listConfigs() {
    return this.revenueSharingModel.find().sort({ version: -1 }).exec();
  }

  async createNewVersion(dto: UpdateRevenueSharingDto, actor?: any) {
    this.validatePercentages(
      dto.senderBranchPercent,
      dto.receiverBranchPercent,
      dto.companyPercent,
    );

    const current = await this.getCurrentConfig();

    await this.revenueSharingModel.updateMany(
      { isActive: true },
      { $set: { isActive: false } },
    );

    const config = await this.revenueSharingModel.create({
      version: (current.version ?? 0) + 1,
      senderBranchPercent: dto.senderBranchPercent,
      receiverBranchPercent: dto.receiverBranchPercent,
      companyPercent: dto.companyPercent,
      isActive: true,
      note: dto.note?.trim() || null,
      updatedByUserId: actor?._id ? new Types.ObjectId(actor._id.toString()) : null,
    });

    await this.adminActivityService.log({
      action: 'revenue_sharing_updated',
      actor,
      details: `${actor?.name ?? 'Admin'} activated revenue-sharing version ${config.version}: ${config.senderBranchPercent}% sender / ${config.receiverBranchPercent}% receiver / ${config.companyPercent}% company.`,
    });

    return config;
  }
}
