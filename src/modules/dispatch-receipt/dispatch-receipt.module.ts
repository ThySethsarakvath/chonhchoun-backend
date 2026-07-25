import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DispatchReceipt,
  DispatchReceiptSchema,
} from '../../shared/schemas/dispatch-receipt.schema';
import {
  BranchLogisticsShipment,
  BranchLogisticsShipmentSchema,
} from '../../shared/schemas/branch-logistics-shipment.schema';
import { Branch, BranchSchema } from '../../shared/schemas/branch.schema';
import { User, UserSchema } from '../../shared/schemas/user.schema';
import {
  DriverVehicleAssignment,
  DriverVehicleAssignmentSchema,
} from '../../shared/schemas/driver-vehicle-assignment.schema';
import { Vehicle, VehicleSchema } from '../../shared/schemas/vehicle.schema';
import { OsrmService } from '../../shared/osrm/osrm.service';
import { DispatchReceiptController } from './dispatch-receipt.controller';
import { DispatchReceiptPlannerService } from './dispatch-receipt-planner.service';
import { DispatchReceiptService } from './dispatch-receipt.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DispatchReceipt.name, schema: DispatchReceiptSchema },
      {
        name: BranchLogisticsShipment.name,
        schema: BranchLogisticsShipmentSchema,
      },
      { name: Branch.name, schema: BranchSchema },
      { name: User.name, schema: UserSchema },
      {
        name: DriverVehicleAssignment.name,
        schema: DriverVehicleAssignmentSchema,
      },
      { name: Vehicle.name, schema: VehicleSchema },
    ]),
  ],
  controllers: [DispatchReceiptController],
  providers: [
    DispatchReceiptService,
    DispatchReceiptPlannerService,
    OsrmService,
  ],
  exports: [DispatchReceiptService],
})
export class DispatchReceiptModule {}
