import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PackagesService } from './packages.service';
import { PackagesController } from './packages.controller';
import { TrackingController } from './tracking.controller';
import {
  Package,
  PackageSchema,
} from '../../shared/schemas/package.schema';
import { User, UserSchema } from '../../shared/schemas/user.schema';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../database/cloudinary/cloudinary.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Package.name, schema: PackageSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
    CloudinaryModule,
  ],
  controllers: [PackagesController, TrackingController],
  providers: [PackagesService],
  exports: [PackagesService],
})
export class PackagesModule {}

