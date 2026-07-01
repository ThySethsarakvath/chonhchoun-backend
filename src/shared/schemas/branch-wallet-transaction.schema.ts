import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { BranchWalletTransactionStatus } from '../../common/enum/branch-wallet-transaction-status.enum';
import { BranchWalletTransactionType } from '../../common/enum/branch-wallet-transaction-type.enum';

export type BranchWalletTransactionDocument = BranchWalletTransaction &
  Document;

@Schema({ timestamps: true })
export class BranchWalletTransaction {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Branch', required: true })
  branchId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'BranchWallet',
    required: true,
  })
  walletId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'BranchLogisticsShipment',
    default: null,
  })
  shipmentId?: Types.ObjectId | null;

  @Prop({ type: String, default: null, trim: true })
  ticketNumber?: string | null;

  @Prop({ type: String, enum: BranchWalletTransactionType, required: true })
  type: BranchWalletTransactionType;

  @Prop({ type: String, default: 'BRANCH_LOGISTICS', trim: true })
  source: string;

  @Prop({
    type: String,
    enum: BranchWalletTransactionStatus,
    default: BranchWalletTransactionStatus.POSTED,
  })
  status: BranchWalletTransactionStatus;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: String, required: true, trim: true })
  description: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata: Record<string, any>;
}

export const BranchWalletTransactionSchema = SchemaFactory.createForClass(
  BranchWalletTransaction,
);

BranchWalletTransactionSchema.index({ branchId: 1, createdAt: -1 });
BranchWalletTransactionSchema.index({ shipmentId: 1 });
