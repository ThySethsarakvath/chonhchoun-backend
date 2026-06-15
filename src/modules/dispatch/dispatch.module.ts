import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DispatchController } from './dispatch.controller';
import { DispatchService } from './dispatch.service';
import { OsrmService } from '../../shared/osrm/osrm.service';

import { BranchesModule } from '../branches/branches.module';
import { PackagesModule } from '../packages/packages.module';
import { DriversModule } from '../drivers/drivers.module';
import { DeliveriesModule } from '../deliveries/deliveries.module';
import { AuthModule } from '../auth/auth.module';

import { Delivery, DeliverySchema } from '../../shared/schemas/delivery.schema';
import { WarehousePackage, WarehousePackageSchema } from '../../shared/schemas/warehouse-package.schema';
import { Driver, DriverSchema } from '../../shared/schemas/driver.schema';
import { Branch, BranchSchema } from '../../shared/schemas/branch.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Delivery.name, schema: DeliverySchema },
      { name: WarehousePackage.name, schema: WarehousePackageSchema },
      { name: Driver.name, schema: DriverSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
    AuthModule,
    BranchesModule,
    PackagesModule,
    DriversModule,
    DeliveriesModule,
  ],
  controllers: [DispatchController],
  providers: [DispatchService, OsrmService],
})
export class DispatchModule {}