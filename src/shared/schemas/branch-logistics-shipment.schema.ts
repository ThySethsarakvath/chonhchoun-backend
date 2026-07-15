import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { BranchLogisticsPricingMode } from '../../common/enum/branch-logistics-pricing-mode.enum';
import { BranchLogisticsStatus } from '../../common/enum/branch-logistics-status.enum';

export type BranchLogisticsShipmentDocument = BranchLogisticsShipment &
  Document;

@Schema({ timestamps: true, _id: false })
export class BranchLogisticsPartyInfo {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  phone: string;
}

const BranchLogisticsPartyInfoSchema = SchemaFactory.createForClass(
  BranchLogisticsPartyInfo,
);

@Schema({ timestamps: true })
export class BranchLogisticsShipment {
  @Prop({ required: true, unique: true, trim: true })
  ticketNumber: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Branch', required: true })
  senderBranchId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Branch', required: true })
  receiverBranchId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdByUserId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  senderUserId?: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  receiverUserId?: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  assignedDriverId?: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Vehicle', default: null })
  assignedVehicleId?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  assignedAt?: Date | null;

  @Prop({ type: BranchLogisticsPartyInfoSchema, required: true })
  sender: BranchLogisticsPartyInfo;

  @Prop({ type: BranchLogisticsPartyInfoSchema, required: true })
  receiver: BranchLogisticsPartyInfo;

  @Prop({ required: true, trim: true })
  itemDescription: string;

  @Prop({
    type: String,
    enum: BranchLogisticsPricingMode,
    default: BranchLogisticsPricingMode.STANDARD,
  })
  pricingMode: BranchLogisticsPricingMode;

  @Prop({ type: Number, default: null })
  weightKg?: number | null;

  @Prop({ type: Number, default: null })
  lengthCm?: number | null;

  @Prop({ type: Number, default: null })
  widthCm?: number | null;

  @Prop({ type: Number, default: null })
  heightCm?: number | null;

  @Prop({ type: Number, default: null })
  volumeM3?: number | null;

  @Prop({ type: Number, default: null })
  chargeableWeightKg?: number | null;

  @Prop({ type: Number, default: null })
  unitPrice?: number | null;

  @Prop({ type: Number, default: 0 })
  startingFee: number;

  @Prop({ type: Number, default: 0 })
  chargeableFee: number;

  @Prop({ type: Number, default: 0 })
  routeFee: number;

  @Prop({ type: Number, default: 0 })
  serviceFee: number;

  @Prop({ type: Number, default: 0 })
  basePrice: number;

  @Prop({ type: Number, default: 0 })
  extraFee: number;

  @Prop({ type: Number, default: 0 })
  discount: number;

  @Prop({ type: Number, required: true })
  totalPrice: number;

  @Prop({ type: String, default: 'USD', trim: true })
  currency: string;

  @Prop({ type: String, default: 'PAID', trim: true })
  paymentStatus: string;

  @Prop({ type: Number, default: 0 })
  amountPaid: number;

  @Prop({ type: Date, default: null })
  paidAt?: Date | null;

  @Prop({
    type: String,
    enum: BranchLogisticsStatus,
    default: BranchLogisticsStatus.CREATED,
  })
  status: BranchLogisticsStatus;

  @Prop({ type: String, default: null, trim: true })
  notes?: string | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'DispatchReceipt', default: null })
  dispatchReceiptId?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  receivedAtSenderWarehouseAt?: Date | null;

  @Prop({ type: Date, default: null })
  inTransitAt?: Date | null;

  @Prop({ type: Date, default: null })
  receivedAtReceiverWarehouseAt?: Date | null;

  @Prop({ type: Date, default: null })
  readyForPickupAt?: Date | null;

  @Prop({ type: Date, default: null })
  completedAt?: Date | null;

  @Prop({ type: Date, default: null })
  cancelledAt?: Date | null;
}

export const BranchLogisticsShipmentSchema = SchemaFactory.createForClass(
  BranchLogisticsShipment,
);

BranchLogisticsShipmentSchema.index({ senderBranchId: 1, createdAt: -1 });
BranchLogisticsShipmentSchema.index({ receiverBranchId: 1, createdAt: -1 });
BranchLogisticsShipmentSchema.index({ status: 1, createdAt: -1 });
BranchLogisticsShipmentSchema.index({ assignedDriverId: 1, status: 1 });
BranchLogisticsShipmentSchema.index({ assignedVehicleId: 1, status: 1 });
