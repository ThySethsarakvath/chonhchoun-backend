import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DispatchController } from './dispatch.controller';
import { DispatchService } from './dispatch.service';
import { OsrmService } from '../../shared/osrm/osrm.service';

import { BranchesModule } from '../branches/branches.module';
import { PackagesModule } from '../packages/packages.module';
import { UsersModule } from '../users/users.module';
import { DeliveriesModule } from '../deliveries/deliveries.module';
import { AuthModule } from '../auth/auth.module';

import { Delivery, DeliverySchema } from '../../shared/schemas/delivery.schema';
import { WarehousePackage, WarehousePackageSchema } from '../../shared/schemas/warehouse-package.schema';
import { User, UserSchema } from '../../shared/schemas/user.schema';
import { Branch, BranchSchema } from '../../shared/schemas/branch.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Delivery.name, schema: DeliverySchema },
      { name: WarehousePackage.name, schema: WarehousePackageSchema },
      { name: User.name, schema: UserSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
    AuthModule,
    BranchesModule,
    PackagesModule,
    UsersModule,
    DeliveriesModule,
  ],
  controllers: [DispatchController],
  providers: [DispatchService, OsrmService],
})
export class DispatchModule {}