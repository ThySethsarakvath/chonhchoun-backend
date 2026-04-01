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

import { User, UserDocument } from './schemas/user.schema';
import { RefreshToken, RefreshTokenDocument } from './schemas/refresh-token.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name) private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ── Register ────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const existing = await this.userModel.findOne({ email: dto.email }).exec();
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.userModel.create({ ...dto, password: hashed });

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user._id as Types.ObjectId, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // ── Login ────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    // +password re-includes the field excluded by select:false in schema
    const user = await this.userModel.findOne({ email: dto.email }).select('+password').exec();
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user._id as Types.ObjectId, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // ── Refresh Tokens ───────────────────────────────────────────────────────
  async refresh(userId: string, rawRefreshToken: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user || !user.isActive) throw new UnauthorizedException('User not found');

    // Find all non-revoked tokens for this user and check which one matches
    const storedTokens = await this.refreshTokenModel.find({
      userId: new Types.ObjectId(userId),
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    });

    let matchedToken: RefreshTokenDocument | null = null;
    for (const stored of storedTokens) {
      const isMatch = await bcrypt.compare(rawRefreshToken, stored.token);
      if (isMatch) { matchedToken = stored; break; }
    }

    if (!matchedToken) throw new UnauthorizedException('Invalid or expired refresh token');

    // Revoke the used token (rotation — each refresh token is single-use)
    matchedToken.isRevoked = true;
    await matchedToken.save();

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user._id as Types.ObjectId, tokens.refreshToken);

    return tokens;
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  async logout(userId: string) {
    // Revoke all refresh tokens for this user
    await this.refreshTokenModel.updateMany(
      { userId: new Types.ObjectId(userId), isRevoked: false },
      { isRevoked: true },
    );
    return { message: 'Logged out successfully' };
  }

  // ── Get current user profile ─────────────────────────────────────────────
  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');
    return this.sanitizeUser(user);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private async generateTokens(user: UserDocument) {
    const payload = { sub: user._id.toString(), email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.secret'),
        expiresIn: this.configService.get('jwt.expiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.refreshSecret'),
        expiresIn: this.configService.get('jwt.refreshExpiresIn'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: Types.ObjectId, rawToken: string) {
    const hashed = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.refreshTokenModel.create({ userId, token: hashed, expiresAt });
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