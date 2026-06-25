import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  VehicleType,
  PackageType,
  BookingStatus,
  PaymentPayer,
  PaymentMethod,
  PaymentStatus,
} from '../../common/enum/package.enum';

export type PackageDocument = Package & Document;

@Schema({ _id: false })
class Location {
  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ required: true })
  latitude: number;

  @Prop({ required: true })
  longitude: number;

  @Prop({ required: true, trim: true })
  contactName: string;

  @Prop({ required: true, trim: true })
  phone: string;
}
const LocationSchema = SchemaFactory.createForClass(Location);

@Schema({ _id: false })
class PackageDetail {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, enum: PackageType })
  type: PackageType;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ type: Number, default: null })
  weightKg: number | null;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: String, default: null })
  note: string | null;
}
const PackageDetailSchema = SchemaFactory.createForClass(PackageDetail);

@Schema({ _id: false })
class PaymentInfo {
  @Prop({ required: true, enum: PaymentPayer })
  payer: PaymentPayer;

  @Prop({ required: true, enum: PaymentMethod })
  method: PaymentMethod;

  @Prop({ required: true, enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Prop({ type: Number, default: null })
  amount: number | null;
}
const PaymentInfoSchema = SchemaFactory.createForClass(PaymentInfo);

@Schema({ timestamps: true })
export class Package {
  @Prop({ required: true, unique: true, trim: true })
  trackingNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  customerId: Types.ObjectId;

  @Prop({ required: true, enum: VehicleType })
  vehicleType: VehicleType;

  @Prop({ type: PackageDetailSchema, required: true })
  package: PackageDetail;

  @Prop({ type: LocationSchema, required: true })
  pickup: Location;

  @Prop({ type: LocationSchema, required: true })
  dropoff: Location;

  @Prop({ type: PaymentInfoSchema, required: true })
  payment: PaymentInfo;

  @Prop({
    required: true,
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  @Prop({ type: Date, default: null })
  scheduledAt: Date | null;

  @Prop({ type: Number, default: null })
  estimatedDistanceKm: number | null;

  @Prop({ type: Number, default: null })
  estimatedPrice: number | null;

  @Prop({ type: String, default: null })
  cancellationReason: string | null;

  @Prop({ type: Date, default: null })
  cancelledAt: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  driverId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  podImage: string | null;

  @Prop({ type: Date, default: null })
  deliveredAt: Date | null;
}

export const PackageSchema = SchemaFactory.createForClass(Package);

PackageSchema.index({ customerId: 1, createdAt: -1 });
PackageSchema.index({ status: 1 });
PackageSchema.index({ driverId: 1 });