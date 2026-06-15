import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Branch, BranchSchema } from '../../shared/schemas/branch.schema';
import {
  DriverVehicleAssignment,
  DriverVehicleAssignmentSchema,
} from '../../shared/schemas/driver-vehicle-assignment.schema';
import {
  DriverApplication,
  DriverApplicationSchema,
} from '../../shared/schemas/driver-application.schema';
import { User, UserSchema } from '../../shared/schemas/user.schema';
import { Vehicle, VehicleSchema } from '../../shared/schemas/vehicle.schema';
import { MailModule } from '../mail/mail.module';
import { DriverApplicationsController } from './driver-applications.controller';
import { DriverApplicationsService } from './driver-applications.service';

@Module({
  imports: [
    MailModule,
    MongooseModule.forFeature([
      { name: DriverApplication.name, schema: DriverApplicationSchema },
      { name: User.name, schema: UserSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      {
        name: DriverVehicleAssignment.name,
        schema: DriverVehicleAssignmentSchema,
      },
    ]),
  ],
  controllers: [DriverApplicationsController],
  providers: [DriverApplicationsService],
  exports: [DriverApplicationsService],
})
export class DriverApplicationsModule {}
