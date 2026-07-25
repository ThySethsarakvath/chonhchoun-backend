import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../../shared/schemas/user.schema';
import { Vehicle, VehicleSchema } from '../../shared/schemas/vehicle.schema';
import {
  DriverVehicleAssignment,
  DriverVehicleAssignmentSchema,
} from '../../shared/schemas/driver-vehicle-assignment.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      {
        name: DriverVehicleAssignment.name,
        schema: DriverVehicleAssignmentSchema,
      },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
