import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BranchStatus } from '../../common/enum/branch-status.enum';
import { Branch, BranchDocument } from '../../shared/schemas/branch.schema';
import { UserDocument } from '../../shared/schemas/user.schema';
import { CreateOwnerBranchDto } from './dto/create-owner-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  async findByOwnerId(ownerId: string | Types.ObjectId) {
    return this.branchModel.findOne({ ownerId }).exec();
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

    return this.branchModel.create({
      name: `Branch ${branchNumber}`,
      branchNumber,
      code: `BRANCH_${branchNumber}`,
      ownerId: user._id as Types.ObjectId,
      phone: dto.phone.trim(),
      address: dto.address.trim(),
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
        'name branchNumber ownerId address phone latitude longitude location logoUrl status isVisibleOnMap',
      )
      .exec();
  }
}
