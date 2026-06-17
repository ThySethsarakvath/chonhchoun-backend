import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  // The package (delivery) this conversation belongs to — the room key.
  @Prop({ type: Types.ObjectId, ref: 'Package', required: true })
  packageId: Types.ObjectId;

  // Who sent it (a customer or the assigned driver).
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  text: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Fetch a package's messages in chronological order efficiently.
MessageSchema.index({ packageId: 1, createdAt: 1 });
