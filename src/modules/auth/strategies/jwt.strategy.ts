import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User, UserDocument } from '../../../shared/schemas/user.schema';
import { RedisService } from '../../redis/redis.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  jti: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
    });
  }

  async validate(payload: JwtPayload) {
    // Check if this token has been blacklisted (i.e. user logged out)
    if (payload.jti) {
      const blacklisted = await this.redisService.isTokenBlacklisted(
        payload.jti,
      );
      if (blacklisted)
        throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.userModel.findById(payload.sub);
    if (!user || !user.isActive)
      throw new UnauthorizedException('User not found or inactive');

    return {
      _id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
      jti: payload.jti,
    };
  }
}
