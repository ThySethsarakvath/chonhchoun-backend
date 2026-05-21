import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {  PackageStatus, PackageType, PayerType, PaymentMethod, VehicleType } from '../../common/enum/package.enum';

export type PackageDocument = Package & Document;

@Schema({ _id: false })
export class Location {
  @Prop({ required: true })
  address!: string;

  @Prop({ required: true, type: Number })
  latitude!: number;

  @Prop({ required: true, type: Number })
  longitude!: number;
}

export const LocationSchema = SchemaFactory.createForClass(Location);

@Schema({ _id: false })
export class Contact {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  phone!: string;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);

@Schema({ _id: false })
export class PackageItem {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, enum: PackageType })
  type!: PackageType;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ type: String, default: null })
  note!: string | null;
}

export const PackageItemSchema = SchemaFactory.createForClass(PackageItem);

@Schema({ _id: false })
export class Pickup {
  @Prop({ type: LocationSchema, required: true })
  location!: Location;

  @Prop({ type: ContactSchema, required: true })
  contact!: Contact;

  @Prop({ type: Date, required: true })
  scheduledAt!: Date;

  @Prop({ type: Date, default: null })
  actualPickupAt!: Date | null;
}

export const PickupSchema = SchemaFactory.createForClass(Pickup);

@Schema({ _id: false })
export class Dropoff {
  @Prop({ type: LocationSchema, required: true })
  location!: Location;

  @Prop({ type: ContactSchema, required: true })
  contact!: Contact;

  @Prop({ type: Date, default: null })
  estimatedDeliveryAt!: Date | null;

  @Prop({ type: Date, default: null })
  actualDeliveryAt!: Date | null;
}

export const DropoffSchema = SchemaFactory.createForClass(Dropoff);

@Schema({ _id: false })
export class Payment {
  @Prop({ required: true, enum: PayerType })
  payer!: PayerType;

  @Prop({ required: true, enum: PaymentMethod })
  method!: PaymentMethod;

  @Prop({ type: Number, default: null })
  estimatedCost!: number | null;

  @Prop({ type: Number, default: null })
  actualCost!: number | null;

  @Prop({ type: Boolean, default: false })
  isPaid!: boolean;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

@Schema({ timestamps: true })
export class Package {

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId!: Types.ObjectId;

  @Prop({ required: true, enum: VehicleType })
  vehicleType!: VehicleType;

  @Prop({ type: [PackageItemSchema], required: true })
  items!: PackageItem[];

  @Prop({ type: PickupSchema, required: true })
  pickup!: Pickup;

  @Prop({ type: DropoffSchema, required: true })
  dropoff!: Dropoff;

  @Prop({ type: PaymentSchema, required: true })
  payment!: Payment;

  @Prop({ enum: PackageStatus, default: PackageStatus.DRAFT })
  status!: PackageStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  assignedDriverId!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  notes!: string | null;
}

export const PackageSchema = SchemaFactory.createForClass(Package);

// ─ Indexes for faster queries ────────────────────────────────────────────
PackageSchema.index({ senderId: 1, createdAt: -1 }); // Find by sender + sort by date
PackageSchema.index({ status: 1 }); // Filter by status
PackageSchema.index({ assignedDriverId: 1 }); // Find by assigned driver
