import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Delivery, DeliveryDocument, DeliveryStatus } from '../../shared/schemas/delivery.schema';

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectModel(Delivery.name) private readonly deliveryModel: Model<DeliveryDocument>,
  ) {}

  findAll(branchId?: string) {
    const filter: any = {};
    if (branchId) filter.sourceBranchId = branchId;
    return this.deliveryModel.find(filter)
      .populate('sourceBranchId', 'name address')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string) {
    const d = await this.deliveryModel.findById(id)
      .populate('sourceBranchId', 'name address latitude longitude')
      .populate('packageIds', 'trackingCode description status destinationBranchId')
      .populate('routes.driverId', 'name email phone driverProfile')
      .populate('routes.stops.branchId', 'name address latitude longitude')
      .populate('routes.stops.packageIds', 'trackingCode description');
    if (!d) throw new NotFoundException('Delivery not found');
    return d;
  }

  async markDriverCompleted(deliveryId: string, driverIdStr: string) {
    const delivery = await this.deliveryModel.findById(deliveryId);
    if (!delivery) throw new NotFoundException('Delivery not found');

    const route = delivery.routes.find(
      r => r.driverId.toString() === driverIdStr,
    );
    if (!route) throw new NotFoundException('Driver route not found in this delivery');

    route.isCompleted = true;

    const allDone = delivery.routes.every(r => r.isCompleted);
    if (allDone) delivery.status = DeliveryStatus.COMPLETED;
    else delivery.status = DeliveryStatus.IN_PROGRESS;

    return delivery.save();
  }

  async cancel(id: string, reason?: string) {
    const d = await this.deliveryModel.findByIdAndUpdate(
      id,
      { status: DeliveryStatus.CANCELLED, cancelledReason: reason ?? null },
      { new: true },
    );
    if (!d) throw new NotFoundException('Delivery not found');
    return d;
  }
}