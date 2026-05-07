import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../common/enum/role.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false }) // select:false = never returned in queries by default
  password: string;

  @Prop({ required: true, enum: Role, default: Role.CUSTOMER })
  role: Role;

  @Prop({ default: true })
  isActive: boolean;

 @Prop({ type: String, default: null })
  avatarUrl?: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
