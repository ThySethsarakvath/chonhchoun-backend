import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RedisModule } from './modules/redis/redis.module';
import { MailModule } from './modules/mail/mail.module';
import { PasswordModule} from './modules/auth/password/password.module';
import { CloudinaryModule } from './modules/database/cloudinary/cloudinary.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { RegistrationModule } from './modules/auth/registration/registration.module';
import { PackagesModule } from './modules/packages/packages.module';
import configuration from './config/configuration';
import { BranchesModule } from './modules/branches/branches.module';
import { DriverApplicationsModule } from './modules/driver-applications/driver-applications.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { DeliveriesModule } from './modules/deliveries/deliveries.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { MqttModule } from './modules/mqtt/mqtt.module';

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
    BranchesModule,
    PackagesModule,
    DriversModule,
    DeliveriesModule,
    DispatchModule,
    DriverApplicationsModule,
    TrackingModule,
    MqttModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
