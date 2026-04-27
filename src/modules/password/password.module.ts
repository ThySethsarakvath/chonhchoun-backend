import { Module } from '@nestjs/common';
import { PasswordService } from './password.service';
import { PasswordController } from './password.controller';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    AuthModule,
    MailModule,
  ],
  controllers: [PasswordController],
  providers: [PasswordService],
})
export class PasswordModule {}