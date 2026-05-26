import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type AdminActivityDocument = AdminActivity & Document;

@Schema({ timestamps: true })
export class AdminActivity {
  @Prop({ required: true, trim: true })
  action: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  actorId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  actorName: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  targetUserId?: Types.ObjectId;

  @Prop({ trim: true })
  targetUserName?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Branch' })
  branchId?: Types.ObjectId;

  @Prop({ trim: true })
  branchName?: string;

  @Prop()
  branchNumber?: number;

  @Prop({ trim: true })
  details?: string;
}

export const AdminActivitySchema =
  SchemaFactory.createForClass(AdminActivity);
