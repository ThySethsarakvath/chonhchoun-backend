import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RevenueSharingConfig,
  RevenueSharingConfigSchema,
} from '../../shared/schemas/revenue-sharing-config.schema';
import { AdminActivityModule } from './admin-activity.module';
import { RevenueSharingService } from './revenue-sharing.service';

@Module({
  imports: [
    AdminActivityModule,
    MongooseModule.forFeature([
      { name: RevenueSharingConfig.name, schema: RevenueSharingConfigSchema },
    ]),
  ],
  providers: [RevenueSharingService],
  exports: [RevenueSharingService],
})
export class RevenueSharingModule {}
