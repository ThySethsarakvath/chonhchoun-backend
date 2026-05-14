import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [AgenciesModule],
  controllers: [AdminController],
})
export class AdminModule {}
