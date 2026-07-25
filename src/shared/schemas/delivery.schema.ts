import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DeliveryDocument = Delivery & Document;

export enum DeliveryStatus {
  PLANNED     = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED   = 'COMPLETED',
  CANCELLED   = 'CANCELLED',
}

@Schema({ _id: false })
class RouteStop {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  branchId: Types.ObjectId;

  @Prop({ required: true })
  stopOrder: number;

  @Prop({ required: true })
  estimatedArrivalSeconds: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'WarehousePackage' }], default: [] })
  packageIds: Types.ObjectId[];
}
const RouteStopSchema = SchemaFactory.createForClass(RouteStop);

@Schema({ _id: false })
class DriverRoute {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  driverId: Types.ObjectId;

  @Prop({ type: [RouteStopSchema], default: [] })
  stops: RouteStop[];

  @Prop({ required: true })
  totalDurationSeconds: number;

  // New: total weight this driver is carrying
  @Prop({ type: Number, default: 0 })
  totalWeightKg: number;

  @Prop({ type: String, default: null })
  routeGeometry: string | null;

  @Prop({ required: true, default: false })
  isCompleted: boolean;
}
const DriverRouteSchema = SchemaFactory.createForClass(DriverRoute);

@Schema({ timestamps: true })
export class Delivery {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  sourceBranchId: Types.ObjectId;

  @Prop({ required: true, enum: DeliveryStatus, default: DeliveryStatus.PLANNED })
  status: DeliveryStatus;

  @Prop({ type: [DriverRouteSchema], default: [] })
  routes: DriverRoute[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'WarehousePackage' }] })
  packageIds: Types.ObjectId[];

  @Prop({ type: Number, required: true })
  totalPackages: number;

  @Prop({ type: Number, required: true })
  totalDrivers: number;

  @Prop({ type: [Number], default: [] })
  unassignedLocationIndices: number[];

  @Prop({ type: String, default: null })
  cancelledReason: string | null;
}

export const DeliverySchema = SchemaFactory.createForClass(Delivery);