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
// import { PackagesModule } from './modules/packages/packages.module';
import configuration from './config/configuration';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}