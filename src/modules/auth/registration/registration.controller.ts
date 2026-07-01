import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { InitiateRegisterDto } from '../dto/initiate-register.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { CompleteRegisterDto } from '../dto/complete-register.dto';

@Controller('auth/register')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  // STEP 1 — POST /api/v1/auth/register/initiate
  // Body: { name, email }
  // Action: validates email not taken, sends 6-digit OTP
  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  initiate(@Body() dto: InitiateRegisterDto) {
    return this.registrationService.initiate(dto);
  }

  // STEP 2 — POST /api/v1/auth/register/verify-email
  // Body: { email, otp }
  // Action: verifies PIN, returns setupToken (30 min TTL)
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.registrationService.verifyEmail(dto);
  }

  // STEP 3 — POST /api/v1/auth/register/complete
  // Body: { setupToken, password, confirmPassword, role? }
  // Action: creates account, returns accessToken + refreshToken (user is logged in)
  @Post('complete')
  @HttpCode(HttpStatus.CREATED)
  complete(@Body() dto: CompleteRegisterDto) {
    return this.registrationService.complete(dto);
  }
}
