import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PackageDocument = Package & Document;

@Schema({ timestamps: true })
export class Package {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  driverId: Types.ObjectId;

  @Prop({ required: true })
  itemName: String;

  @Prop()
  itemDescription: String;

  @Prop({ required: true, enum: ['S', 'M', 'L'] })
  size: String;

  @Prop({ required: true })
  weight: Number;

  @Prop({ required: true, enum: ['document', 'food', 'clothing', 'electronics', 'others'] })
  itemType: String;

  @Prop({ required: true, enum: ['bike', 'tuktuk'] })
  vehicleType: String;

  @Prop({ required: true, enum: ['express', 'warehouse'] })
  serviceType: String;

  @Prop({ default: false })
  itemHandling: Boolean;

  @Prop({ required: true })
  pickupAddress: String;

  @Prop({ required: true })
  dropoffAddress: String;

  @Prop({ required: true })
  pickupLat: Number;

  @Prop({ required: true })
  pickupLng: Number;

  @Prop({ required: true })
  dropoffLat: Number;

  @Prop({ required: true })
  dropoffLng: Number;

  @Prop({ required: true })
  price: Number;

  @Prop({ required: true, enum: ['cash', 'online'] })
  paymentMethod: String;

  @Prop()
  dropoffContactName: String;

  @Prop()
  dropoffContactNumber: String;

  @Prop()
  noteToDriver: String;

  @Prop({ required: true, enum: ['searching', 'accepted', 'pickedUp', 'delivered', 'canceled'], default: 'searching' })
  status: String;
}

export const PackageSchema = SchemaFactory.createForClass(Package);
