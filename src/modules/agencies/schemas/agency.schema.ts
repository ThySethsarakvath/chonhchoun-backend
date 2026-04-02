import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true }) 
export class Agency extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  city_province: string;

  @Prop({ required: true })
  address: string;

  @Prop()
  latitude: number;

  @Prop()
  longitude: number;

  @Prop()
  contact_number: string;

  
  @Prop({ 
    type: String, 
    enum: ['NORMAL', 'URGENT'], 
    default: 'NORMAL' 
  })
  service_type: string;

  
  @Prop({ 
    type: String, 
    enum: ['ACTIVE', 'INACTIVE'], 
    default: 'ACTIVE' 
  })
  status: string;
}

export const AgencySchema = SchemaFactory.createForClass(Agency);