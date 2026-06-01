import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgenciesModule } from '../agencies/agencies.module';
import { BranchesModule } from '../branches/branches.module';
import {
  AdminActivity,
  AdminActivitySchema,
} from '../../shared/schemas/admin-activity.schema';
import { User, UserSchema } from '../../shared/schemas/user.schema';
import { AdminController } from './admin.controller';
import { AdminActivityService } from './admin-activity.service';
import { AdminService } from './admin.service';

@Module({
  imports: [
    AgenciesModule,
    BranchesModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AdminActivity.name, schema: AdminActivitySchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminActivityService],
})
export class AdminModule {}
