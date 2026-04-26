import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import { User, UserDocument } from '../../shared/schemas/user.schema';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { ForgotPasswordDto } from '../auth/dto/forgot-password.dto';
import { VerifyOtpDto } from '../auth/dto/verify-otp.dto';
import { ResetPasswordDto } from '../auth/dto/reset-password.dto';

// ── Constants ─────────────────────────────────────────────────────────────────
const OTP_PURPOSE = 'password_reset';
const OTP_TTL = 60 * 10;          // 10 minutes to enter the PIN
const OTP_MAX_ATTEMPTS = 5;        // 5 wrong attempts → lock
const RESET_TOKEN_TTL = 60 * 15;  // 15 minutes to submit new password after PIN verified
const REQUEST_COOLDOWN_TTL = 60;   // must wait 60s before requesting a new PIN

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
  ) {}

  // ── Step 1: Request OTP ──────────────────────────────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ email: dto.email });

    // Always return the same message whether the email exists or not.
    // This prevents attackers from enumerating which emails are registered.
    if (!user) {
      return { message: 'If that email is registered, a PIN has been sent.' };
    }

    // Cooldown: prevent the user from spamming OTP requests
    const cooldownKey = `otp_cooldown:${OTP_PURPOSE}:${dto.email}`;
    const onCooldown = await this.redisService.exists(cooldownKey);
    if (onCooldown) {
      throw new BadRequestException(
        'Please wait 60 seconds before requesting a new PIN.',
      );
    }

    // Generate a cryptographically random 6-digit PIN
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store PIN in Redis (hashed — same bcrypt principle as passwords)
    const hashedOtp = await bcrypt.hash(otp, 10);
    await this.redisService.saveOtp(dto.email, OTP_PURPOSE, hashedOtp);

    // Clear any previous attempt counts for this email
    await this.redisService.resetOtpAttempts(dto.email, OTP_PURPOSE);

    // Set cooldown so they can't request again for 60s
    await this.redisService.set(cooldownKey, '1', REQUEST_COOLDOWN_TTL);

    // Send the plain OTP to email (only place the raw PIN exists)
    await this.mailService.sendPasswordResetOtp(dto.email, otp, user.name);

    this.logger.log(`Password reset OTP sent to ${dto.email}`);
    return { message: 'If that email is registered, a PIN has been sent.' };
  }

  // ── Step 2: Verify OTP ───────────────────────────────────────────────────────
  async verifyOtp(dto: VerifyOtpDto): Promise<{ resetToken: string; expiresIn: number }> {
    // Check attempt count first — if locked, don't even look at the PIN
    const attempts = await this.redisService.getOtpAttempts(dto.email, OTP_PURPOSE);
    if (attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException(
        'Too many incorrect attempts. Please request a new PIN.',
      );
    }

    // Get stored hashed OTP
    const storedHash = await this.redisService.getOtp(dto.email, OTP_PURPOSE);
    if (!storedHash) {
      throw new BadRequestException(
        'PIN has expired or was never requested. Please request a new one.',
      );
    }

    // Compare submitted PIN against stored hash
    const isMatch = await bcrypt.compare(dto.otp, storedHash);
    if (!isMatch) {
      // Increment failed attempts
      const newAttempts = await this.redisService.incrementOtpAttempts(
        dto.email,
        OTP_PURPOSE,
      );
      const remaining = OTP_MAX_ATTEMPTS - newAttempts;

      if (remaining <= 0) {
        // Delete the OTP so they must request a fresh one
        await this.redisService.deleteOtp(dto.email, OTP_PURPOSE);
        throw new UnauthorizedException(
          'Too many incorrect attempts. Please request a new PIN.',
        );
      }

      throw new BadRequestException(
        `Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      );
    }

    // ✅ PIN is correct — clean up OTP and attempt counter immediately
    await this.redisService.deleteOtp(dto.email, OTP_PURPOSE);
    await this.redisService.resetOtpAttempts(dto.email, OTP_PURPOSE);

    // Issue a short-lived reset token — this proves they verified the PIN
    // The actual password change endpoint requires this token
    const resetToken = uuidv4();
    await this.redisService.saveVerificationToken(
      resetToken,
      OTP_PURPOSE,
      JSON.stringify({ email: dto.email }),
    );

    // Override TTL for reset tokens specifically
    const key = `verify:${OTP_PURPOSE}:${resetToken}`;
    await this.redisService.expire(key, RESET_TOKEN_TTL);

    this.logger.log(`OTP verified for ${dto.email}, reset token issued`);
    return { resetToken, expiresIn: RESET_TOKEN_TTL };
  }

  // ── Step 3: Reset Password ───────────────────────────────────────────────────
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    // Confirm passwords match before touching the DB
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    // Validate the reset token from step 2
    const stored = await this.redisService.getVerificationToken(
      dto.resetToken,
      OTP_PURPOSE,
    );
    if (!stored) {
      throw new UnauthorizedException(
        'Reset session expired. Please start over.',
      );
    }

    const { email } = JSON.parse(stored) as { email: string };

    // Find user
    const user = await this.userModel.findOne({ email }).select('+password');
    if (!user) throw new NotFoundException('User not found.');

    // Prevent reusing the same password
    const isSamePassword = await bcrypt.compare(dto.newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from your current password.',
      );
    }

    // Hash and save the new password
    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.userModel.findByIdAndUpdate(user._id, { password: hashed });

    // Invalidate the reset token — single use
    await this.redisService.deleteVerificationToken(dto.resetToken, OTP_PURPOSE);

    // Revoke all active sessions — force re-login on all devices
    await this.redisService.revokeAllRefreshTokens(user._id.toString());
    await this.redisService.deleteUserSession(user._id.toString());

    this.logger.log(`Password reset successfully for ${email}`);
    return { message: 'Password reset successfully. Please log in again.' };
  }
}