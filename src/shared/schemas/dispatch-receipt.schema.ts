import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { DispatchReceiptStatus } from '../../common/enum/dispatch-receipt-status.enum';
import { DispatchReceiptStopStatus } from '../../common/enum/dispatch-receipt-stop-status.enum';

export type DispatchReceiptDocument = DispatchReceipt & Document;

@Schema({ _id: false, timestamps: false })
export class DispatchReceiptStop {
  @Prop({ required: true })
  stopOrder: number;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Branch',
    required: true,
  })
  destinationBranchId: Types.ObjectId;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'BranchLogisticsShipment' }],
    default: [],
  })
  shipmentIds: Types.ObjectId[];

  @Prop({
    type: String,
    enum: DispatchReceiptStopStatus,
    default: DispatchReceiptStopStatus.PENDING,
  })
  status: DispatchReceiptStopStatus;

  @Prop({ type: Date, default: null })
  arrivedAt?: Date | null;

  @Prop({ type: Date, default: null })
  confirmedAt?: Date | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  confirmedByUserId?: Types.ObjectId | null;

  @Prop({ type: String, default: null, trim: true })
  confirmationNotes?: string | null;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'BranchLogisticsShipment' }],
    default: [],
  })
  missingShipmentIds: Types.ObjectId[];

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'BranchLogisticsShipment' }],
    default: [],
  })
  damagedShipmentIds: Types.ObjectId[];
}

export const DispatchReceiptStopSchema =
  SchemaFactory.createForClass(DispatchReceiptStop);

@Schema({ timestamps: true })
export class DispatchReceipt {
  @Prop({ required: true, unique: true, trim: true })
  receiptNumber: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Branch',
    required: true,
  })
  sourceBranchId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  driverId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Vehicle',
    default: null,
  })
  vehicleId?: Types.ObjectId | null;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdByUserId: Types.ObjectId;

  @Prop({
    type: String,
    enum: DispatchReceiptStatus,
    default: DispatchReceiptStatus.CREATED,
  })
  status: DispatchReceiptStatus;

  @Prop({ type: [DispatchReceiptStopSchema], default: [] })
  stops: DispatchReceiptStop[];

  @Prop({ type: Date, default: null })
  departedAt?: Date | null;

  @Prop({ type: Date, default: null })
  completedAt?: Date | null;

  @Prop({ type: Date, default: null })
  cancelledAt?: Date | null;

  @Prop({ type: String, default: null, trim: true })
  notes?: string | null;
}

export const DispatchReceiptSchema =
  SchemaFactory.createForClass(DispatchReceipt);

DispatchReceiptSchema.index({ sourceBranchId: 1, createdAt: -1 });
DispatchReceiptSchema.index({ driverId: 1, status: 1 });
DispatchReceiptSchema.index({ status: 1, createdAt: -1 });
DispatchReceiptSchema.index(
  { 'stops.destinationBranchId': 1, status: 1 },
);
