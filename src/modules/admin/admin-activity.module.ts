import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AdminActivity,
  AdminActivitySchema,
} from '../../shared/schemas/admin-activity.schema';
import { AdminActivityService } from './admin-activity.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminActivity.name, schema: AdminActivitySchema },
    ]),
  ],
  providers: [AdminActivityService],
  exports: [AdminActivityService],
})
export class AdminActivityModule {}
