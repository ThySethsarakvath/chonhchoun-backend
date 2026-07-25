import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { DriverAvailabilityStatus } from '../../common/enum/driver-availability-status.enum';
import { Role } from '../../common/enum/role.enum';
import { VehicleType } from '../../common/enum/package.enum';

export type UserDocument = User & Document;

@Schema({ _id: false })
export class DriverProfile {
  @Prop({ required: true, default: 'MOTORCYCLE' })
  vehicleType: string;

  @Prop({ required: true, default: 0 })
  balance: number;

  @Prop({ required: true, default: false })
  isOnline: boolean;

  @Prop({
    type: {
      lat: { type: Number },
      lng: { type: Number },
    },
    default: null,
  })
  currentLocation?: { lat: number; lng: number } | null;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ required: true, enum: Role, default: Role.CUSTOMER })
  role: Role;

  @Prop({ type: String, enum: VehicleType, default: null })
  vehicleType: VehicleType | null;

  @Prop({ type: String, trim: true, default: null })
  assignedVehicleCode: string | null;

  @Prop({
    type: String,
    enum: DriverAvailabilityStatus,
    default: DriverAvailabilityStatus.OFFLINE,
  })
  availabilityStatus: DriverAvailabilityStatus;

  @Prop({ type: [String], enum: VehicleType, default: [] })
  supportedVehicleTypes: VehicleType[];

  @Prop({ type: String, trim: true, default: null })
  licenseNumber?: string | null;

  @Prop({ type: Date, default: null })
  licenseExpiry?: Date | null;

  @Prop({ type: Number, default: null })
  maxLoadWeightKg?: number | null;

  @Prop({ type: Number, default: null })
  maxPackageCount?: number | null;

  @Prop({
    required: true,
    unique: true,
    trim: true,
    match: [
      /^\+855(1[0-9]|2[0-9]|3[0-9]|6[0-9]|7[0-9]|8[0-9]|9[0-9])\d{6,7}$/,
      'Phone number must be a valid Cambodian number (e.g. +85512345678)',
    ],
  })
  phone: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: String, default: null })
  avatarUrl: string | null;

  @Prop({ type: String, default: null })
  avatarPublicId: string | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Branch', default: null })
  branchId?: Types.ObjectId | null;

  @Prop({ type: DriverProfile, default: null })
  driverProfile?: DriverProfile | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
