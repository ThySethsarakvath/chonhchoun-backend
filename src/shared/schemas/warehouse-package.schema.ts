import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WarehousePackageDocument = WarehousePackage & Document;

export enum WarehousePackageStatus {
  PENDING   = 'PENDING',
  ASSIGNED  = 'ASSIGNED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  FAILED    = 'FAILED',
}

export enum PackagePriority {
  URGENT   = 'URGENT',
  STANDARD = 'STANDARD',
  LOW      = 'LOW',
}

@Schema({ timestamps: true })
export class WarehousePackage {
  @Prop({ required: true, trim: true })
  trackingCode: string;

  // Source warehouse
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  sourceBranchId: Types.ObjectId;

  // Destination warehouse
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  destinationBranchId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ type: Number, min: 0.1 })
  weightKg: number;

  @Prop({
    required: true,
    enum: PackagePriority,
    default: PackagePriority.STANDARD,
  })
  priority: PackagePriority;

  @Prop({ required: true, enum: WarehousePackageStatus, default: WarehousePackageStatus.PENDING })
  status: WarehousePackageStatus;

  // Set when assigned to a delivery
  @Prop({ type: Types.ObjectId, ref: 'Delivery', default: null })
  deliveryId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  note: string | null;
}

export const WarehousePackageSchema = SchemaFactory.createForClass(WarehousePackage);

WarehousePackageSchema.index({ sourceBranchId: 1, status: 1 });
WarehousePackageSchema.index({ trackingCode: 1 }, { unique: true });