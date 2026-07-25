import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
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
export class WarehousePackagesService {
  private readonly logger = new Logger(WarehousePackagesService.name);

  constructor(
    @InjectModel(WarehousePackage.name)
    private readonly pkgModel: Model<WarehousePackageDocument>,
  ) {}

  async createWarehousePackage(dto: CreateWarehousePackageDto) {
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

  async findAllWarehousePackages(branchId?: string, status?: string) {
    const filter: any = {};
    if (branchId) filter.sourceBranchId = new Types.ObjectId(branchId);
    if (status) filter.status = status;
    
    return this.pkgModel.find(filter)
      .populate('sourceBranchId destinationBranchId', 'name address latitude longitude')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findWarehousePackageById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid ID');
    const p = await this.pkgModel.findById(id)
      .populate('sourceBranchId destinationBranchId', 'name address latitude longitude')
      .populate('deliveryId');
    if (!p) throw new NotFoundException('Warehouse package not found');
    return p;
  }

  async updateWarehousePackage(id: string, dto: UpdateWarehousePackageDto) {
    const p = await this.findWarehousePackageById(id);
    if (p.status !== WarehousePackageStatus.PENDING) {
      throw new BadRequestException('Only PENDING packages can be edited');
    }
    return this.pkgModel.findByIdAndUpdate(id, dto, { new: true });
  }

  async deleteWarehousePackage(id: string) {
    const p = await this.findWarehousePackageById(id);
    if (p.status !== WarehousePackageStatus.PENDING) {
      throw new BadRequestException('Only PENDING packages can be deleted');
    }
    await this.pkgModel.findByIdAndDelete(id);
    return { message: 'Warehouse package deleted' };
  }

  async updateWarehousePackageStatus(id: string, status: WarehousePackageStatus, user: any) {
    const p = await this.findWarehousePackageById(id);
    
    // Validate lifecycle
    const validTransitions: Record<WarehousePackageStatus, WarehousePackageStatus[]> = {
      [WarehousePackageStatus.PENDING]: [WarehousePackageStatus.ASSIGNED],
      [WarehousePackageStatus.ASSIGNED]: [WarehousePackageStatus.IN_TRANSIT],
      [WarehousePackageStatus.IN_TRANSIT]: [WarehousePackageStatus.DELIVERED, WarehousePackageStatus.FAILED],
      [WarehousePackageStatus.DELIVERED]: [],
      [WarehousePackageStatus.FAILED]: [],
    };

    if (!validTransitions[p.status].includes(status)) {
      throw new BadRequestException(`Cannot transition from ${p.status} to ${status}`);
    }

    p.status = status;
    await p.save();
    
    this.logger.log(`Warehouse Package ${p.trackingCode} transitioned to ${status}`);
    return p;
  }

  // Called strictly by DispatchService after assignment
  async markAssigned(ids: string[], deliveryId: string) {
    if (!ids.length) return;
    
    await this.pkgModel.updateMany(
      { _id: { $in: ids.map(id => new Types.ObjectId(id)) } },
      { 
        $set: { 
          status: WarehousePackageStatus.ASSIGNED, 
          deliveryId: new Types.ObjectId(deliveryId) 
        } 
      },
    );
    this.logger.log(`Marked ${ids.length} warehouse packages as ASSIGNED to delivery ${deliveryId}`);
  }
}
