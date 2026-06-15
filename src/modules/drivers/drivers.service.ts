import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Driver, DriverDocument, DriverStatus } from '../../shared/schemas/driver.schema';
import { CreateDriverDto, UpdateDriverDto } from './dto/driver.dto';

@Injectable()
export class DriversService {
  constructor(
    @InjectModel(Driver.name) private readonly driverModel: Model<DriverDocument>,
  ) {}

  async create(dto: CreateDriverDto) {
    return this.driverModel.create({
      ...dto,
      userId: new Types.ObjectId(dto.userId),
      currentBranchId: new Types.ObjectId(dto.currentBranchId),
    });
  }

  findAll() {
    return this.driverModel.find()
      .populate('userId', 'name email phone avatarUrl')
      .populate('currentBranchId', 'name address')
      .exec();
  }

  async findOne(id: string) {
    const d = await this.driverModel.findById(id)
      .populate('userId', 'name email phone')
      .populate('currentBranchId', 'name address');
    if (!d) throw new NotFoundException('Driver not found');
    return d;
  }

  // Get available drivers near a branch
  findAvailableAtBranch(branchId: string) {
    return this.driverModel
      .find({
        currentBranchId: new Types.ObjectId(branchId),
        status: DriverStatus.AVAILABLE,
        isActive: true,
      })
      .populate('userId', 'name phone')
      .exec();
  }

  async update(id: string, dto: UpdateDriverDto) {
    const updateData: any = { ...dto };
    if (dto.currentBranchId) {
      updateData.currentBranchId = new Types.ObjectId(dto.currentBranchId);
    }

    const d = await this.driverModel.findByIdAndUpdate({ new: true });
    if (!d) throw new NotFoundException('Driver not found');
    return d;
  }

  // Called by DispatchService
  async markOnDelivery(driverIds: string[]) {
    await this.driverModel.updateMany(
      { _id: { $in: driverIds.map(id => new Types.ObjectId(id)) } },
      { status: DriverStatus.ON_DELIVERY },
    );
  }

  async markAvailable(driverId: string) {
    await this.driverModel.findByIdAndUpdate(driverId, { status: DriverStatus.AVAILABLE });
  }
}