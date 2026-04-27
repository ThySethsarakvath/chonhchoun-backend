import {
  Injectable,
  BadRequestException,
  ConflictException,
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
import { AuthService } from '../auth/auth.service';
import { InitiateRegisterDto } from '../auth/dto/initiate-register.dto';
import { VerifyEmailDto } from '../auth/dto/verify-email.dto';
import { CompleteRegisterDto } from '../auth/dto/complete-register.dto';
import { Role } from '../../common/enum/role.enum';

const OTP_PURPOSE = 'email_verification';
const SETUP_TOKEN_PURPOSE = 'registration_setup';
const OTP_TTL = 60 * 10;           // 10 min to enter the PIN
const OTP_MAX_ATTEMPTS = 5;
const SETUP_TOKEN_TTL = 60 * 30;   // 30 min to complete registration after PIN verified
const REQUEST_COOLDOWN_TTL = 60;   // 60s between OTP requests

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
    private readonly authService: AuthService,
  ) {}

  async initiate(dto: InitiateRegisterDto): Promise<{ message: string }> {
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) {
      throw new ConflictException('This email is already registered. Please log in.');
    }

    const cooldownKey = `otp_cooldown:${OTP_PURPOSE}:${dto.email}`;
    const onCooldown = await this.redisService.exists(cooldownKey);
    if (onCooldown) {
      throw new BadRequestException(
        'Please wait 60 seconds before requesting a new PIN.',
      );
    }

    // Generate 6-digit PIN
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    // Store PIN in Redis
    await this.redisService.saveOtp(dto.email, OTP_PURPOSE, hashedOtp);
    await this.redisService.resetOtpAttempts(dto.email, OTP_PURPOSE);

    // Store name temporarily in Redis so we have it when creating the account
    // Key: pending_register:email → { name }
    await this.redisService.set(
      `pending_register:${dto.email}`,
      JSON.stringify({ name: dto.name }),
      OTP_TTL,
    );

    // Set cooldown
    await this.redisService.set(cooldownKey, '1', REQUEST_COOLDOWN_TTL);

    // Send OTP email
    await this.mailService.sendRegistrationOtp(dto.email, otp, dto.name);

    this.logger.log(`Registration OTP sent to ${dto.email}`);
    return { message: 'A verification PIN has been sent to your email.' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ setupToken: string; expiresIn: number }> {
    // Check attempt lockout
    const attempts = await this.redisService.getOtpAttempts(dto.email, OTP_PURPOSE);
    if (attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException(
        'Too many incorrect attempts. Please request a new PIN.',
      );
    }

    // Get stored hash
    const storedHash = await this.redisService.getOtp(dto.email, OTP_PURPOSE);
    if (!storedHash) {
      throw new BadRequestException(
        'PIN has expired or was never requested. Please start again.',
      );
    }

    // Compare
    const isMatch = await bcrypt.compare(dto.otp, storedHash);
    if (!isMatch) {
      const newAttempts = await this.redisService.incrementOtpAttempts(
        dto.email,
        OTP_PURPOSE,
      );
      const remaining = OTP_MAX_ATTEMPTS - newAttempts;

      if (remaining <= 0) {
        await this.redisService.deleteOtp(dto.email, OTP_PURPOSE);
        throw new UnauthorizedException(
          'Too many incorrect attempts. Please request a new PIN.',
        );
      }

      throw new BadRequestException(
        `Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      );
    }

    // PIN correct — clean up OTP
    await this.redisService.deleteOtp(dto.email, OTP_PURPOSE);
    await this.redisService.resetOtpAttempts(dto.email, OTP_PURPOSE);

    // Get the pending name stored in step 1
    const pendingRaw = await this.redisService.get(`pending_register:${dto.email}`);
    const { name } = pendingRaw
      ? (JSON.parse(pendingRaw) as { name: string })
      : { name: '' };

    // Issue setupToken — proves this email was verified
    const setupToken = uuidv4();
    await this.redisService.saveVerificationToken(
      setupToken,
      SETUP_TOKEN_PURPOSE,
      JSON.stringify({ email: dto.email, name }),
    );
    await this.redisService.expire(
      `verify:${SETUP_TOKEN_PURPOSE}:${setupToken}`,
      SETUP_TOKEN_TTL,
    );

    this.logger.log(`Email verified for ${dto.email}, setup token issued`);
    return { setupToken, expiresIn: SETUP_TOKEN_TTL };
  }

  async complete(dto: CompleteRegisterDto): Promise<any> {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    // Validate setupToken
    const stored = await this.redisService.getVerificationToken(
      dto.setupToken,
      SETUP_TOKEN_PURPOSE,
    );
    if (!stored) {
      throw new UnauthorizedException(
        'Registration session expired. Please start over.',
      );
    }

    const { email, name } = JSON.parse(stored) as { email: string; name: string };

    // Final check — email still not taken (edge case: someone registered between steps)
    const existing = await this.userModel.findOne({ email });
    if (existing) {
      throw new ConflictException('This email was just registered. Please log in.');
    }

    // Hash password and create the user
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.userModel.create({
      name,
      email,
      password: hashed,
      role: dto.role ?? Role.CUSTOMER,
      isActive: true,
    });

    // Invalidate the setup token — single use
    await this.redisService.deleteVerificationToken(dto.setupToken, SETUP_TOKEN_PURPOSE);

    // Clean up pending registration data
    await this.redisService.del(`pending_register:${email}`);

    // Issue auth tokens — user is immediately logged in after registering
    // Delegate to AuthService so token logic stays in one place
    const tokens = await this.authService.issueTokensForUser(user);

    this.logger.log(`New user registered: ${email} (${user.role})`);
    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: (user as any).createdAt,
      },
      ...tokens,
    };
  }
}