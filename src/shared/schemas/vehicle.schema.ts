import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { VehicleType } from '../../common/enum/package.enum';
import { VehicleOwnershipType } from '../../common/enum/vehicle-ownership-type.enum';
import { VehicleStatus } from '../../common/enum/vehicle-status.enum';

export type VehicleDocument = Vehicle & Document;

@Schema({ timestamps: true })
export class Vehicle {
  @Prop({ required: true, trim: true })
  code: string;

  @Prop({ type: String, trim: true, default: null })
  plateNumber?: string | null;

  @Prop({ type: String, enum: VehicleType, required: true })
  type: VehicleType;

  @Prop({
    type: String,
    enum: VehicleOwnershipType,
    default: VehicleOwnershipType.COMPANY,
  })
  ownershipType: VehicleOwnershipType;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Branch', default: null })
  branchId?: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  ownerDriverId?: Types.ObjectId | null;

  @Prop({ type: Number, default: null })
  maxWeightKg?: number | null;

  @Prop({ type: Number, default: null })
  maxVolumeM3?: number | null;

  @Prop({ type: Number, default: null })
  maxPackageCount?: number | null;

  @Prop({ type: String, trim: true, default: null })
  currentWarehouse?: string | null;

  @Prop({
    type: String,
    enum: VehicleStatus,
    default: VehicleStatus.AVAILABLE,
  })
  status: VehicleStatus;

  @Prop({ default: true })
  isActive: boolean;
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle);

VehicleSchema.index({ code: 1 }, { unique: true });
VehicleSchema.index({ branchId: 1, status: 1 });
VehicleSchema.index({ ownerDriverId: 1 }, { sparse: true });
