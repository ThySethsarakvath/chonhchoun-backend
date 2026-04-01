import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
// import { PackagesModule } from './modules/packages/packages.module';
import configuration from './config/configuration';

@Module({
  imports: [
    // 1. Global config — always first
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),

    // 2. Database
    DatabaseModule,

    // 3. Feature modules
    AuthModule,
    UsersModule,
    // PackagesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}