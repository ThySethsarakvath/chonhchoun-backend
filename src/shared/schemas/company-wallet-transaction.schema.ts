import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { BranchWalletTransactionStatus } from '../../common/enum/branch-wallet-transaction-status.enum';
import { BranchWalletTransactionType } from '../../common/enum/branch-wallet-transaction-type.enum';

export type CompanyWalletTransactionDocument = CompanyWalletTransaction &
  Document;

@Schema({ timestamps: true })
export class CompanyWalletTransaction {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'CompanyWallet',
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

export const CompanyWalletTransactionSchema = SchemaFactory.createForClass(
  CompanyWalletTransaction,
);

CompanyWalletTransactionSchema.index({ shipmentId: 1 });
CompanyWalletTransactionSchema.index({ createdAt: -1 });
