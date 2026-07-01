import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PackagesService } from './packages.service';
import { PackagesController } from './packages.controller';
import { Package, PackageSchema } from '../../shared/schemas/package.schema';
import { WarehousePackage, WarehousePackageSchema } from '../../shared/schemas/warehouse-package.schema';
import { User, UserSchema } from '../../shared/schemas/user.schema';
import { AuthModule } from '../auth/auth.module';
import { WarehousePackagesController } from './warehouse-packages.controller';
import { WarehousePackagesService } from './warehouse-packages.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Package.name, schema: PackageSchema },
      { name: WarehousePackage.name, schema: WarehousePackageSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
  ],
  controllers: [PackagesController, WarehousePackagesController],
  providers: [PackagesService, WarehousePackagesService],
  exports: [PackagesService, WarehousePackagesService],
})
export class PackagesModule {}
