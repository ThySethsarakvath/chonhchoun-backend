import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import { User, UserDocument } from './schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService, // ← injected
  ) {}

  // ── Register ─────────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.userModel.create({ ...dto, password: hashed });

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user._id.toString(), tokens.refreshToken);

    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ── Login ─────────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.userModel
      .findOne({ email: dto.email })
      .select('+password');
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user._id.toString(), tokens.refreshToken);

    // Cache lightweight session in Redis to avoid DB hits on every request
    await this.redisService.saveUserSession(user._id.toString(), {
      name: user.name,
      email: user.email,
      role: user.role,
    });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ── Refresh ───────────────────────────────────────────────────────────────────
  async refresh(userId: string, rawRefreshToken: string, tokenId: string) {
    // 1. Get the stored hash from Redis using tokenId embedded in the JWT
    const storedHash = await this.redisService.getRefreshToken(userId, tokenId);
    if (!storedHash) throw new UnauthorizedException('Refresh token expired or revoked');

    // 2. Verify the raw token matches the stored hash
    const isMatch = await bcrypt.compare(rawRefreshToken, storedHash);
    if (!isMatch) throw new UnauthorizedException('Invalid refresh token');

    // 3. Revoke the used token (token rotation — single use)
    await this.redisService.revokeRefreshToken(userId, tokenId);

    // 4. Get user from DB
    const user = await this.userModel.findById(userId);
    if (!user || !user.isActive) throw new UnauthorizedException('User not found');

    // 5. Issue a new pair
    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(userId, tokens.refreshToken);

    return tokens;
  }

  // ── Logout ────────────────────────────────────────────────────────────────────
  async logout(userId: string, jti?: string) {
    // Revoke all refresh tokens for this user in Redis
    await this.redisService.revokeAllRefreshTokens(userId);

    // Blacklist the current access token so it can't be reused before expiry
    if (jti) await this.redisService.blacklistAccessToken(jti);

    // Remove session cache
    await this.redisService.deleteUserSession(userId);

    return { message: 'Logged out successfully' };
  }

  // ── Get profile ───────────────────────────────────────────────────────────────
  async getProfile(userId: string) {
    // Try Redis session first before hitting MongoDB
    const cached = await this.redisService.getUserSession(userId);
    if (cached) {
      return { _id: userId, ...cached, fromCache: true };
    }

    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.sanitizeUser(user);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  private async generateTokens(user: UserDocument) {
  const tokenId = uuidv4();

  const payload = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
    jti: tokenId,
  };

  const [accessToken, refreshToken] = await Promise.all([
    this.jwtService.signAsync(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.expiresIn'),
    }),
    this.jwtService.signAsync(
      { ...payload, jti: uuidv4() },
      {
        secret: this.configService.get('jwt.refreshSecret'),
        expiresIn: this.configService.get('jwt.refreshExpiresIn'),
      },
    ),
  ]);

  return { accessToken, refreshToken, tokenId };
}

  private async storeRefreshToken(userId: string, rawToken: string) {
    // Decode to get the jti embedded in the refresh token
    const decoded = this.jwtService.decode(rawToken) as any;
    const tokenId = decoded?.jti ?? uuidv4();

    const hashed = await bcrypt.hash(rawToken, 10);
    await this.redisService.saveRefreshToken(userId, tokenId, hashed);
    return tokenId;
  }

  private sanitizeUser(user: UserDocument) {
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: (user as any).createdAt,
    };
  }
}