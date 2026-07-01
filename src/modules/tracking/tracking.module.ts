import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TrackingController],
})
export class TrackingModule {}