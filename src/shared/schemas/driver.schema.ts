import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DriverDocument = Driver & Document;

export enum DriverStatus {
  AVAILABLE   = 'AVAILABLE',
  ON_DELIVERY = 'ON_DELIVERY',
  OFF_DUTY    = 'OFF_DUTY',
}

export enum VehicleType {
  MOTORCYCLE  = 'MOTORCYCLE',
  CAR         = 'CAR',
  TRUCK_SMALL = 'TRUCK_SMALL',
  TRUCK_LARGE = 'TRUCK_LARGE',
}

export const VEHICLE_CAPACITY_KG: Record<VehicleType, number> = {
  [VehicleType.MOTORCYCLE]:  30,
  [VehicleType.CAR]:         150,
  [VehicleType.TRUCK_SMALL]: 500,
  [VehicleType.TRUCK_LARGE]: 2000,
};

@Schema({ timestamps: true })
export class Driver {
  // Link to users collection — driver must have role=DRIVER
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  // Which branch this driver is currently stationed at / near
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  currentBranchId: Types.ObjectId;

  @Prop({ required: true, enum: VehicleType })
  vehicleType: VehicleType;

  @Prop({ required: true, trim: true })
  vehiclePlate: string;

  @Prop({ required: true, enum: DriverStatus, default: DriverStatus.AVAILABLE })
  status: DriverStatus;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  shiftStart: number; // e.g. 28800 = 08:00
 
  @Prop({ type: Number, default: 86399 })
  shiftEnd: number;   // e.g. 64800 = 18:00

  @Prop({ type: [String], default: [] })
  preferredZones: string[];
}

export const DriverSchema = SchemaFactory.createForClass(Driver);
DriverSchema.index({ currentBranchId: 1, status: 1 });