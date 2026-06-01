import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Branch, BranchDocument } from '../../shared/schemas/branch.schema';

@Injectable()
export class AgenciesRepository {
  constructor(
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  createBranch(payload: Partial<Branch>) {
    return this.branchModel.create(payload);
  }

  findBranches() {
    return this.branchModel
      .find({ ownerId: { $exists: true, $ne: null } })
      .populate('ownerId', 'name email phone')
      .sort({ branchNumber: 1, name: 1 })
      .exec();
  }

  findBranchById(id: string) {
    return this.branchModel
      .findById(id)
      .populate('ownerId', 'name email phone')
      .exec();
  }

  findBranchByCode(code: string) {
    return this.branchModel.findOne({ code }).exec();
  }

  updateBranch(id: string, payload: Partial<Branch>) {
    return this.branchModel
      .findByIdAndUpdate(id, payload, { returnDocument: 'after' })
      .populate('ownerId', 'name email phone')
      .exec();
  }

  countBranches() {
    return this.branchModel.countDocuments().exec();
  }
}
