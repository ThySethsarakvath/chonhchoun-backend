import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Agency, AgencyDocument } from '../../shared/schemas/agency.schema';
import { Branch, BranchDocument } from '../../shared/schemas/branch.schema';

@Injectable()
export class AgenciesRepository {
  constructor(
    @InjectModel(Agency.name)
    private readonly agencyModel: Model<AgencyDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  createBranch(payload: Partial<Branch>) {
    return this.branchModel.create(payload);
  }

  findBranches() {
    return this.branchModel.find().sort({ name: 1 }).exec();
  }

  findBranchById(id: string) {
    return this.branchModel.findById(id).exec();
  }

  findBranchByCode(code: string) {
    return this.branchModel.findOne({ code }).exec();
  }

  updateBranch(id: string, payload: Partial<Branch>) {
    return this.branchModel.findByIdAndUpdate(id, payload, { new: true }).exec();
  }

  createAgency(payload: Partial<Agency>) {
    return this.agencyModel.create(payload);
  }

  findAgencies() {
    return this.agencyModel
      .find()
      .populate('user', 'name email phone role isActive avatarUrl')
      .populate('branch')
      .sort({ createdAt: -1 })
      .exec();
  }

  findAgencyById(id: string) {
    return this.agencyModel
      .findById(id)
      .populate('user', 'name email phone role isActive avatarUrl')
      .populate('branch')
      .exec();
  }

  findAgencyByUserId(userId: string | Types.ObjectId) {
    return this.agencyModel
      .findOne({ user: userId })
      .populate('user', 'name email phone role isActive avatarUrl')
      .populate('branch')
      .exec();
  }

  updateAgency(id: string, payload: Partial<Agency>) {
    return this.agencyModel
      .findByIdAndUpdate(id, payload, { new: true })
      .populate('user', 'name email phone role isActive avatarUrl')
      .populate('branch')
      .exec();
  }

  countBranches() {
    return this.branchModel.countDocuments().exec();
  }

  countAgencies() {
    return this.agencyModel.countDocuments().exec();
  }
}
