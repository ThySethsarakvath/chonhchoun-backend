import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OnboardingDocument = Onboarding & Document;

@Schema({ timestamps: true })
export class Onboarding {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  subtitle: string;

  @Prop({ required: true })
  imageUrl: string; // Cloudinary secure_url

  @Prop({ required: true })
  imagePublicId: string; // Cloudinary public_id — needed for deletion/update

  @Prop({ default: 0 })
  order: number; // controls display order on the app (slide 1, 2, 3...)

  @Prop({ default: true })
  isActive: boolean; // allows hiding a slide without deleting it
}

export const OnboardingSchema = SchemaFactory.createForClass(Onboarding);
