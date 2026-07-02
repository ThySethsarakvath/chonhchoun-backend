import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { BranchLogisticsPricingMode } from '../../common/enum/branch-logistics-pricing-mode.enum';

export type BranchLogisticsPricingRuleDocument = BranchLogisticsPricingRule &
  Document;

@Schema({ timestamps: true })
export class BranchLogisticsPricingRule {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Branch', default: null })
  senderBranchId?: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Branch', default: null })
  receiverBranchId?: Types.ObjectId | null;

  @Prop({ type: String, enum: BranchLogisticsPricingMode, required: true })
  pricingMode: BranchLogisticsPricingMode;

  @Prop({ type: Number, default: 0 })
  baseFee: number;

  @Prop({ type: Number, default: null })
  pricePerKg?: number | null;

  @Prop({ type: Number, default: null })
  pricePerM3?: number | null;

  @Prop({ type: Number, default: 0 })
  routeFee: number;

  @Prop({ type: Number, default: 0 })
  serviceFee: number;

  @Prop({ type: Number, default: 0 })
  minPrice: number;

  @Prop({ type: Number, default: 250 })
  volumeDivisor: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  effectiveFrom?: Date | null;

  @Prop({ type: Date, default: null })
  effectiveTo?: Date | null;
}

export const BranchLogisticsPricingRuleSchema = SchemaFactory.createForClass(
  BranchLogisticsPricingRule,
);

BranchLogisticsPricingRuleSchema.index({
  senderBranchId: 1,
  receiverBranchId: 1,
  isActive: 1,
});
