import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret')!,
      passReqToCallback: true, // we need the raw token to verify against DB
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) throw new UnauthorizedException();

    const refreshToken = authHeader.replace('Bearer ', '').trim();
    return { ...payload, refreshToken }; // refreshToken attached to req.user
  }
}