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
import { DispatchReceiptController } from './dispatch-receipt.controller';
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
    ]),
  ],
  controllers: [DispatchReceiptController],
  providers: [DispatchReceiptService],
  exports: [DispatchReceiptService],
})
export class DispatchReceiptModule {}
