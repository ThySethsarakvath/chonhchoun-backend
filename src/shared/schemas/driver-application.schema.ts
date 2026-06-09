import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { DriverApplicationStatus } from '../../common/enum/driver-application-status.enum';
import { VehicleType } from '../../common/enum/package.enum';

export type DriverApplicationDocument = DriverApplication & Document;

@Schema({ _id: false })
export class UploadedAsset {
  @Prop({ required: true, trim: true })
  url: string;

  @Prop({ required: true, trim: true })
  publicId: string;

  @Prop({ trim: true })
  originalName?: string;
}

export const UploadedAssetSchema = SchemaFactory.createForClass(UploadedAsset);

@Schema({ timestamps: true })
export class DriverApplication {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Branch', required: true })
  branchId: Types.ObjectId;

  @Prop({ type: String, enum: VehicleType, default: null })
  vehicleType: VehicleType | null;

  @Prop({ type: String, trim: true, default: null })
  assignedVehicleCode: string | null;

  @Prop({ type: UploadedAssetSchema, required: true })
  avatar: UploadedAsset;

  @Prop({ type: UploadedAssetSchema, required: true })
  cv: UploadedAsset;

  @Prop({ type: UploadedAssetSchema, required: true })
  nationalId: UploadedAsset;

  @Prop({ type: UploadedAssetSchema, default: null })
  drivingLicense: UploadedAsset | null;

  @Prop({
    type: String,
    enum: DriverApplicationStatus,
    default: DriverApplicationStatus.PENDING,
  })
  status: DriverApplicationStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  reviewedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  reviewedAt?: Date | null;

  @Prop({ type: String, trim: true, default: null })
  rejectionReason?: string | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  approvedUserId?: Types.ObjectId | null;
}

export const DriverApplicationSchema =
  SchemaFactory.createForClass(DriverApplication);

DriverApplicationSchema.index({ email: 1, status: 1 });
DriverApplicationSchema.index({ phone: 1, status: 1 });
DriverApplicationSchema.index({ branchId: 1, status: 1, createdAt: -1 });
