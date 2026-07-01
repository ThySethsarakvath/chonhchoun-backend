import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CompanyWalletDocument = CompanyWallet & Document;

@Schema({ timestamps: true })
export class CompanyWallet {
  @Prop({
    type: String,
    required: true,
    unique: true,
    default: 'CHONHCHOUN_COMPANY_MAIN',
    trim: true,
  })
  walletKey: string;

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

export const CompanyWalletSchema = SchemaFactory.createForClass(CompanyWallet);

CompanyWalletSchema.index({ walletKey: 1 }, { unique: true });
