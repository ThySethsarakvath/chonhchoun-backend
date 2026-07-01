import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Branch, BranchSchema } from '../../shared/schemas/branch.schema';
import {
  BranchLogisticsPricingRule,
  BranchLogisticsPricingRuleSchema,
} from '../../shared/schemas/branch-logistics-pricing-rule.schema';
import {
  BranchLogisticsShipment,
  BranchLogisticsShipmentSchema,
} from '../../shared/schemas/branch-logistics-shipment.schema';
import {
  DriverVehicleAssignment,
  DriverVehicleAssignmentSchema,
} from '../../shared/schemas/driver-vehicle-assignment.schema';
import { User, UserSchema } from '../../shared/schemas/user.schema';
import { Vehicle, VehicleSchema } from '../../shared/schemas/vehicle.schema';
import { BranchWalletModule } from '../branch-wallet/branch-wallet.module';
import { BranchLogisticsController } from './branch-logistics.controller';
import { BranchLogisticsService } from './branch-logistics.service';
import { RevenueSharingModule } from '../admin/revenue-sharing.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Branch.name, schema: BranchSchema },
      {
        name: BranchLogisticsShipment.name,
        schema: BranchLogisticsShipmentSchema,
      },
      {
        name: BranchLogisticsPricingRule.name,
        schema: BranchLogisticsPricingRuleSchema,
      },
      { name: User.name, schema: UserSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      {
        name: DriverVehicleAssignment.name,
        schema: DriverVehicleAssignmentSchema,
      },
    ]),
    BranchWalletModule,
    RevenueSharingModule,
  ],
  controllers: [BranchLogisticsController],
  providers: [BranchLogisticsService],
  exports: [BranchLogisticsService],
})
export class BranchLogisticsModule {}
