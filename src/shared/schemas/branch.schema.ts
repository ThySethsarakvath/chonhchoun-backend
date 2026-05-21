import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { BranchStatus } from '../../common/enum/branch-status.enum';

export type BranchDocument = Branch & Document;

@Schema({ timestamps: true })
export class Branch {
  @Prop({ required: true })
  name: string;

  @Prop()
  branchNumber?: number;

  @Prop({ trim: true })
  code?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  ownerId?: Types.ObjectId;

  @Prop({ trim: true })
  phone?: string;

  @Prop()
  address?: string;

  @Prop()
  description?: string;

  @Prop({
    type: {
      lat: { type: Number },
      lng: { type: Number },
    },
    _id: false,
  })
  location?: { lat: number; lng: number };

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  @Prop({
    type: String,
    enum: BranchStatus,
    default: BranchStatus.ACTIVE,
  })
  status: BranchStatus;

  @Prop({ default: 'assets/images/branch_partner_logo.png' })
  logoUrl?: string;

  @Prop({ default: true })
  isVisibleOnMap: boolean;

  @Prop({ default: true })
  isActive: boolean;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);
BranchSchema.index({ code: 1 }, { unique: true, sparse: true });
BranchSchema.index({ ownerId: 1 }, { unique: true, sparse: true });
