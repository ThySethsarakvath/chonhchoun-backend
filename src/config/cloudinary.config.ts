import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

export const CLOUDINARY = 'CLOUDINARY';

export const cloudinaryProvider = {
  provide: CLOUDINARY,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    cloudinary.config({
      cloud_name: config.get<string>('cloudinary.cloudName'),
      api_key: config.get<string>('cloudinary.apiKey'),
      api_secret: config.get<string>('cloudinary.apiSecret'),
    });
    return cloudinary;
  },
};
