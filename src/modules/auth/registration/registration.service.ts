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

import { User, UserDocument } from '../../../shared/schemas/user.schema';
import { RedisService } from '../../redis/redis.service';
import { MailService } from '../../mail/mail.service';
import { AuthService } from '../auth.service';
import { InitiateRegisterDto } from '../dto/initiate-register.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { CompleteRegisterDto } from '../dto/complete-register.dto';
import { Role } from '../../../common/enum/role.enum';
import { normalisePhone } from '../../../common/utils/phone.util';

const OTP_PURPOSE = 'email_verification';
const SETUP_TOKEN_PURPOSE = 'registration_setup';
const OTP_TTL = 60 * 10;
const OTP_MAX_ATTEMPTS = 5;
const SETUP_TOKEN_TTL = 60 * 30;
const REQUEST_COOLDOWN_TTL = 60;

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
    const phone = normalisePhone(dto.phone); // always store as +855XXXXXXXXX

    const emailTaken = await this.userModel.findOne({ email: dto.email });
    if (emailTaken) {
      throw new ConflictException('This email is already registered. Please log in.');
    }

    const phoneTaken = await this.userModel.findOne({ phone });
    if (phoneTaken) {
      throw new ConflictException('This phone number is already registered.');
    }

    const cooldownKey = `otp_cooldown:${OTP_PURPOSE}:${dto.email}`;
    const onCooldown = await this.redisService.exists(cooldownKey);
    if (onCooldown) {
      throw new BadRequestException(
        'Please wait 60 seconds before requesting a new PIN.',
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    await this.redisService.saveOtp(dto.email, OTP_PURPOSE, hashedOtp);
    await this.redisService.resetOtpAttempts(dto.email, OTP_PURPOSE);

    await this.redisService.set(
      `pending_register:${dto.email}`,
      JSON.stringify({ name: dto.name, phone }),
      OTP_TTL,
    );

    await this.redisService.set(cooldownKey, '1', REQUEST_COOLDOWN_TTL);
    await this.mailService.sendRegistrationOtp(dto.email, otp, dto.name);

    this.logger.log(`Registration OTP sent to ${dto.email}`);
    return { message: 'A verification PIN has been sent to your email.' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ setupToken: string; expiresIn: number }> {
    const attempts = await this.redisService.getOtpAttempts(dto.email, OTP_PURPOSE);
    if (attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException(
        'Too many incorrect attempts. Please request a new PIN.',
      );
    }

    const storedHash = await this.redisService.getOtp(dto.email, OTP_PURPOSE);
    if (!storedHash) {
      throw new BadRequestException(
        'PIN has expired or was never requested. Please start again.',
      );
    }

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

    await this.redisService.deleteOtp(dto.email, OTP_PURPOSE);
    await this.redisService.resetOtpAttempts(dto.email, OTP_PURPOSE);

    const pendingRaw = await this.redisService.get(`pending_register:${dto.email}`);
    const pending = pendingRaw
      ? (JSON.parse(pendingRaw) as { name: string; phone: string })
      : { name: '', phone: '' };

    const setupToken = uuidv4();
    await this.redisService.saveVerificationToken(
      setupToken,
      SETUP_TOKEN_PURPOSE,
      JSON.stringify({ email: dto.email, name: pending.name, phone: pending.phone }),
    );
    await this.redisService.expire(
      `verify:${SETUP_TOKEN_PURPOSE}:${setupToken}`,
      SETUP_TOKEN_TTL,
    );

    this.logger.log(`Email verified for ${dto.email}, setup token issued`);
    return { setupToken, expiresIn: SETUP_TOKEN_TTL };
  }

  async complete(dto: CompleteRegisterDto): Promise<any> {
    if (dto.role != null && dto.role !== Role.CUSTOMER && dto.role !== Role.DRIVER) {
      throw new BadRequestException(
        'Public registration can only create customer or driver accounts.',
      );
    }

    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    const stored = await this.redisService.getVerificationToken(
      dto.setupToken,
      SETUP_TOKEN_PURPOSE,
    );
    if (!stored) {
      throw new UnauthorizedException(
        'Registration session expired. Please start over.',
      );
    }

    const { email, name, phone } = JSON.parse(stored) as {
      email: string;
      name: string;
      phone: string;
    };

    const existing = await this.userModel.findOne({ email });
    if (existing) {
      throw new ConflictException('This email was just registered. Please log in.');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.userModel.create({
      name,
      email,
      phone,
      password: hashed,
      role: dto.role ?? Role.CUSTOMER,
      isActive: true,
      avatarUrl: null,
      avatarPublicId: null,
      driverProfile: (dto.role === Role.DRIVER) ? {
        vehicleType: dto.vehicleType ?? 'MOTORCYCLE',
        balance: 0,
        isOnline: false,
        currentLocation: null,
      } : null,
    });

    await this.redisService.deleteVerificationToken(dto.setupToken, SETUP_TOKEN_PURPOSE);
    await this.redisService.del(`pending_register:${email}`);

    const tokens = await this.authService.issueTokensForUser(user);

    this.logger.log(`New user registered: ${email} (${user.role})`);
    return {
      user: this.sanitize(user),
      ...tokens,
    };
  }

  private sanitize(user: UserDocument) {
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      avatarUrl: user.avatarUrl,
      driverProfile: user.driverProfile ?? null,
      createdAt: (user as any).createdAt,
    };
  }
}
