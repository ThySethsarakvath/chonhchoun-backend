import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgenciesController } from './agencies.controller';
import { AgenciesService } from './agencies.service';
import { AgenciesRepository } from './agencies.repository';
import { Agency, AgencySchema } from '../../shared/schemas/agency.schema';
import { Branch, BranchSchema } from '../../shared/schemas/branch.schema';
import { User, UserSchema } from '../../shared/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Agency.name, schema: AgencySchema },
      { name: Branch.name, schema: BranchSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AgenciesController],
  providers: [AgenciesService, AgenciesRepository],
  exports: [AgenciesService],
})
export class AgenciesModule {}