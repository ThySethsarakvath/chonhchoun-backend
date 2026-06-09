import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import { User, UserDocument } from '../../shared/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  private normalizeVehicleType(
    vehicleType: string | null | undefined,
  ): string | null {
    if (!vehicleType) return null;
    return vehicleType === 'TRUCK_SMALL' ? 'TRUCK' : vehicleType;
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

    const tokens = await this.issueTokensForUser(user);

    await this.redisService.saveUserSession(user._id.toString(), {
      name: user.name,
      email: user.email,
      role: user.role,
      vehicleType: this.normalizeVehicleType(user.vehicleType) ?? '',
      assignedVehicleCode: user.assignedVehicleCode ?? '',
    });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(userId: string, rawRefreshToken: string, tokenId: string) {
    const storedHash = await this.redisService.getRefreshToken(userId, tokenId);
    if (!storedHash) throw new UnauthorizedException('Refresh token expired or revoked');

    const isMatch = await bcrypt.compare(rawRefreshToken, storedHash);
    if (!isMatch) throw new UnauthorizedException('Invalid refresh token');

    await this.redisService.revokeRefreshToken(userId, tokenId);

    const user = await this.userModel.findById(userId);
    if (!user || !user.isActive) throw new UnauthorizedException('User not found');

    return this.issueTokensForUser(user);
  }

  // ── Logout ────────────────────────────────────────────────────────────────────
  async logout(userId: string, jti?: string) {
    await this.redisService.revokeAllRefreshTokens(userId);
    if (jti) await this.redisService.blacklistAccessToken(jti);
    await this.redisService.deleteUserSession(userId);
    return { message: 'Logged out successfully' };
  }

  // ── Get profile ───────────────────────────────────────────────────────────────
  async getProfile(userId: string) {
    const cached = await this.redisService.getUserSession(userId);
    if (cached) return { _id: userId, ...cached, fromCache: true };

    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.sanitizeUser(user);
  }

  // ── PUBLIC: issue tokens for any user document ────────────────────────────────
  // Used by RegistrationService after account creation so token logic
  // lives in exactly one place.
  async issueTokensForUser(user: UserDocument): Promise<{ accessToken: string; refreshToken: string }> {
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

    // Store hashed refresh token in Redis
    const decoded = this.jwtService.decode(refreshToken) as any;
    const refreshTokenId = decoded?.jti ?? uuidv4();
    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.redisService.saveRefreshToken(
      user._id.toString(),
      refreshTokenId,
      hashed,
    );

    return { accessToken, refreshToken };
  }

  // ── Sanitize — strips sensitive fields before returning to client ─────────────
  sanitizeUser(user: UserDocument) {
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      vehicleType: this.normalizeVehicleType(user.vehicleType),
      assignedVehicleCode: user.assignedVehicleCode ?? null,
      isActive: user.isActive,
      createdAt: (user as any).createdAt,
    };
  }
}
