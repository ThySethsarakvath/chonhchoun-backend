import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgenciesModule } from '../agencies/agencies.module';
import { User, UserSchema } from '../../shared/schemas/user.schema';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    AgenciesModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
