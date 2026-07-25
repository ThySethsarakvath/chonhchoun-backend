import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type RevenueSharingConfigDocument = RevenueSharingConfig & Document;

@Schema({ timestamps: true })
export class RevenueSharingConfig {
  @Prop({ type: Number, required: true, unique: true })
  version: number;

  @Prop({ type: Number, required: true })
  senderBranchPercent: number;

  @Prop({ type: Number, required: true })
  receiverBranchPercent: number;

  @Prop({ type: Number, required: true })
  companyPercent: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: String, trim: true, default: null })
  note?: string | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  updatedByUserId?: Types.ObjectId | null;
}

export const RevenueSharingConfigSchema = SchemaFactory.createForClass(
  RevenueSharingConfig,
);

RevenueSharingConfigSchema.index({ version: -1 }, { unique: true });
RevenueSharingConfigSchema.index({ isActive: 1, createdAt: -1 });
