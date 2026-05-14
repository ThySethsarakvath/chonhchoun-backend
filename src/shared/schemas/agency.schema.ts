import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AgencyDocument = Agency & Document;

@Schema({ timestamps: true })
export class Agency {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) 
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true }) 
  branch: Types.ObjectId;

  @Prop() 
  notes?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const AgencySchema = SchemaFactory.createForClass(Agency);