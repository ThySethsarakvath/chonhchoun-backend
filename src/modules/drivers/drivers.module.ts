import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Driver, DriverSchema } from '../../shared/schemas/driver.schema';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Driver.name, schema: DriverSchema }]),
    AuthModule,
  ],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService, MongooseModule],
})
export class DriversModule {}