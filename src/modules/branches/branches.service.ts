import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Branch, BranchDocument } from '../../shared/schemas/branch.schema';
import { CreateBranchDto, UpdateBranchDto } from './dto/create-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
  ) {}

  create(dto: CreateBranchDto) {
    return this.branchModel.create(dto);
  }

  findAll() {
    return this.branchModel.find({ isActive: true }).sort({ name: 1 }).exec();
  }

  async findOne(id: string) {
    const b = await this.branchModel.findById(id);
    if (!b) throw new NotFoundException('Branch not found');
    return b;
  }

  async update(id: string, dto: UpdateBranchDto) {
    const b = await this.branchModel.findByIdAndUpdate(id, dto, { new: true });
    if (!b) throw new NotFoundException('Branch not found');
    return b;
  }

  async remove(id: string) {
    await this.branchModel.findByIdAndUpdate(id, { isActive: false });
    return { message: 'Branch deactivated' };
  }
}