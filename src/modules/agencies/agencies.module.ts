import { Module } from '@nestjs/common';
import { AgenciesService } from './agencies.service';
import { AgenciesController } from './agencies.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Agency, AgencySchema } from './schemas/agency.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Agency.name, schema: AgencySchema }])
  ],
  providers: [AgenciesService],
  controllers: [AgenciesController]
})
export class AgenciesModule {}
