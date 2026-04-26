import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { cloudinaryProvider } from '../../../config/cloudinary.config';
import { CloudinaryService } from './cloudinary.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [cloudinaryProvider, CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}