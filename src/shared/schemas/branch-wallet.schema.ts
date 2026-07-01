import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type BranchWalletDocument = BranchWallet & Document;

@Schema({ timestamps: true })
export class BranchWallet {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Branch',
    required: true,
    unique: true,
  })
  branchId: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  availableBalance: number;

  @Prop({ type: Number, default: 0 })
  pendingBalance: number;

  @Prop({ type: Number, default: 0 })
  totalCredited: number;

  @Prop({ type: Number, default: 0 })
  totalDebited: number;

  @Prop({ type: String, default: 'USD', trim: true })
  currency: string;
}

export const BranchWalletSchema = SchemaFactory.createForClass(BranchWallet);
