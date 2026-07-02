import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgenciesModule } from '../agencies/agencies.module';
import { BranchesModule } from '../branches/branches.module';
import { User, UserSchema } from '../../shared/schemas/user.schema';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RevenueSharingModule } from './revenue-sharing.module';
import { AdminActivityModule } from './admin-activity.module';

@Module({
  imports: [
    AgenciesModule,
    BranchesModule,
    RevenueSharingModule,
    AdminActivityModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
