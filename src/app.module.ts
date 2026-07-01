import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RedisModule } from './modules/redis/redis.module';
import { MailModule } from './modules/mail/mail.module';
import { PasswordModule } from './modules/auth/password/password.module';
import { CloudinaryModule } from './modules/database/cloudinary/cloudinary.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { RegistrationModule } from './modules/auth/registration/registration.module';
import { PackagesModule } from './modules/packages/packages.module';
import configuration from './config/configuration';
import { AgenciesModule } from './modules/agencies/agencies.module';
import { AdminModule } from './modules/admin/admin.module';
import { BranchesModule } from './modules/branches/branches.module';
import { BranchLogisticsModule } from './modules/branch-logistics/branch-logistics.module';
import { BranchWalletModule } from './modules/branch-wallet/branch-wallet.module';
import { DriverApplicationsModule } from './modules/driver-applications/driver-applications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    RedisModule,
    DatabaseModule,
    AuthModule,
    RegistrationModule,
    MailModule,
    PasswordModule,
    UsersModule,
    CloudinaryModule,
    OnboardingModule,
    PackagesModule,
    AgenciesModule,
    BranchesModule,
    BranchWalletModule,
    BranchLogisticsModule,
    AdminModule,
    DriverApplicationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
