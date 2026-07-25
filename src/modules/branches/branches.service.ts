import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BranchStatus } from '../../common/enum/branch-status.enum';
import { Branch, BranchDocument } from '../../shared/schemas/branch.schema';
import { UserDocument } from '../../shared/schemas/user.schema';
import { CreateOwnerBranchDto } from './dto/create-owner-branch.dto';

@Injectable()
export class BranchesService implements OnModuleInit {
  private readonly logger = new Logger(BranchesService.name);

  constructor(
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  async onModuleInit() {
    await this.backfillBranchOwnerSince();
  }

  async findByOwnerId(ownerId: string | Types.ObjectId) {
    return this.branchModel.findOne({ ownerId }).exec();
  }

  async findDetailedByOwnerId(ownerId: string | Types.ObjectId) {
    return this.branchModel
      .findOne({ ownerId })
      .populate('ownerId', 'name email phone')
      .select(
        'name branchNumber code ownerId address phone description branchOwnerSince latitude longitude location logoUrl status isVisibleOnMap isActive',
      )
      .exec();
  }

  async suspendBranchByOwnerId(ownerId: string | Types.ObjectId) {
    return this.branchModel
      .findOneAndUpdate(
        { ownerId },
        {
          $set: {
            status: BranchStatus.SUSPENDED,
            isActive: false,
            isVisibleOnMap: false,
          },
          $unset: {
            ownerId: 1,
          },
        },
        { returnDocument: 'after' },
      )
      .exec();
  }

  async getNextBranchNumber() {
    const latestBranch = await this.branchModel
      .findOne({ branchNumber: { $exists: true } })
      .sort({ branchNumber: -1 })
      .select('branchNumber')
      .exec();

    return (latestBranch?.branchNumber ?? 0) + 1;
  }

  async createBranchForOwner(user: UserDocument, dto: CreateOwnerBranchDto) {
    const branchNumber = await this.getNextBranchNumber();
    const branchOwnerSince = new Date();

    return this.branchModel.create({
      name: `Branch ${branchNumber}`,
      branchNumber,
      code: `BRANCH_${branchNumber}`,
      ownerId: user._id,
      phone: dto.phone.trim(),
      address: dto.address.trim(),
      branchOwnerSince,
      latitude: dto.latitude,
      longitude: dto.longitude,
      location: {
        lat: dto.latitude,
        lng: dto.longitude,
      },
      status: BranchStatus.ACTIVE,
      logoUrl: 'assets/images/branch_partner_logo.png',
      isVisibleOnMap: true,
      isActive: true,
    });
  }

  private async backfillBranchOwnerSince() {
    const branches = await this.branchModel
      .find({
        ownerId: { $exists: true, $ne: null },
        $or: [
          { branchOwnerSince: { $exists: false } },
          { branchOwnerSince: null },
        ],
      })
      .select('_id createdAt updatedAt')
      .lean<{ _id: Types.ObjectId; createdAt?: Date; updatedAt?: Date }[]>()
      .exec();

    if (!branches.length) {
      return;
    }

    const result = await this.branchModel.bulkWrite(
      branches.map((branch) => ({
        updateOne: {
          filter: { _id: branch._id },
          update: {
            $set: {
              branchOwnerSince:
                branch.createdAt ?? branch.updatedAt ?? new Date(),
            },
          },
        },
      })),
    );

    this.logger.log(
      `Backfilled branchOwnerSince for ${result.modifiedCount} branch(es).`,
    );
  }

  async migratePendingBranchesToActive() {
    const result = await this.branchModel.updateMany(
      { status: 'pending' as any },
      {
        $set: {
          status: BranchStatus.ACTIVE,
          isActive: true,
        },
      },
    );

    return {
      matched: result.matchedCount,
      updated: result.modifiedCount,
    };
  }

  async findVisibleOnMap() {
    return this.branchModel
      .find({
        status: BranchStatus.ACTIVE,
      })
      .sort({ name: 1 })
      .populate('ownerId', 'name email phone')
      .select(
        'name branchNumber ownerId address phone description branchOwnerSince latitude longitude location logoUrl status isVisibleOnMap',
      )
      .exec();
  }
}
