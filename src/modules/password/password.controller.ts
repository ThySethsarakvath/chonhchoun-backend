import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { PasswordService } from './password.service';
import { ForgotPasswordDto } from '../auth/dto/forgot-password.dto';
import { VerifyOtpDto } from '../auth/dto/verify-otp.dto';
import { ResetPasswordDto } from '../auth/dto/reset-password.dto';

@Controller('auth/password')
export class PasswordController {
  constructor(private readonly passwordService: PasswordService) {}

  // POST /api/v1/auth/password/forgot
  // Step 1: user submits their email → PIN sent to inbox
  @Post('forgot')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordService.forgotPassword(dto);
  }

  // POST /api/v1/auth/password/verify-otp
  // Step 2: user submits the 6-digit PIN → receives resetToken
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.passwordService.verifyOtp(dto);
  }

  // POST /api/v1/auth/password/reset
  // Step 3: user submits resetToken + new password → password updated
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordService.resetPassword(dto);
  }
}