import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WarehousePackage,
  WarehousePackageDocument,
  WarehousePackageStatus,
} from '../../shared/schemas/warehouse-package.schema';
import {
  CreateWarehousePackageDto,
  UpdateWarehousePackageDto,
} from '../../shared/dto/warehouse-package.dto';

function generateTrackingCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `WH-${date}-${rand}`;
}

@Injectable()
export class PackagesService {
  constructor(
    @InjectModel(WarehousePackage.name)
    private readonly pkgModel: Model<WarehousePackageDocument>,
  ) {}

  async create(dto: CreateWarehousePackageDto) {
    if (dto.sourceBranchId === dto.destinationBranchId) {
      throw new BadRequestException('Source and destination branches must differ');
    }
    return this.pkgModel.create({
      ...dto,
      sourceBranchId: new Types.ObjectId(dto.sourceBranchId),
      destinationBranchId: new Types.ObjectId(dto.destinationBranchId),
      trackingCode: generateTrackingCode(),
      status: WarehousePackageStatus.PENDING,
    });
  }

  // Get all PENDING packages at a specific source branch
  findPendingByBranch(branchId: string) {
    return this.pkgModel
      .find({ sourceBranchId: new Types.ObjectId(branchId), status: WarehousePackageStatus.PENDING })
      .populate('sourceBranchId destinationBranchId', 'name address latitude longitude')
      .exec();
  }

  findAll(branchId?: string, status?: string) {
    const filter: any = {};
    if (branchId) filter.sourceBranchId = new Types.ObjectId(branchId);
    if (status) filter.status = status;
    return this.pkgModel.find(filter)
      .populate('sourceBranchId destinationBranchId', 'name address latitude longitude')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string) {
    const p = await this.pkgModel.findById(id)
      .populate('sourceBranchId destinationBranchId', 'name address latitude longitude');
    if (!p) throw new NotFoundException('Package not found');
    return p;
  }

  async update(id: string, dto: UpdateWarehousePackageDto) {
    const p = await this.pkgModel.findById(id);
    if (!p) throw new NotFoundException('Package not found');
    if (p.status !== WarehousePackageStatus.PENDING) {
      throw new BadRequestException('Only PENDING packages can be edited');
    }
    return this.pkgModel.findByIdAndUpdate(id, dto, { new: true });
  }

  async remove(id: string) {
    const p = await this.pkgModel.findById(id);
    if (!p) throw new NotFoundException('Package not found');
    if (p.status !== WarehousePackageStatus.PENDING) {
      throw new BadRequestException('Only PENDING packages can be deleted');
    }
    await this.pkgModel.findByIdAndDelete(id);
    return { message: 'Package deleted' };
  }

  // Called by DispatchService after assignment
  async markAssigned(ids: string[], deliveryId: string) {
    await this.pkgModel.updateMany(
      { _id: { $in: ids.map(id => new Types.ObjectId(id)) } },
      { status: WarehousePackageStatus.ASSIGNED, deliveryId: new Types.ObjectId(deliveryId) },
    );
  }
}