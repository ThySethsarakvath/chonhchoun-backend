import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

export const TTL = {
  REFRESH_TOKEN: 60 * 60 * 24 * 7,    // 7 days
  ACCESS_TOKEN_BLACKLIST: 60 * 15,     // 15 minutes (matches JWT expiry)
  OTP: 60 * 5,                         // 5 minutes
  OTP_ATTEMPTS: 60 * 15,              // 15 minutes lockout window
  RATE_LIMIT: 60,                      // 1 minute
  USER_SESSION: 60 * 60 * 24,         // 24 hours
  VERIFICATION_TOKEN: 60 * 60 * 24,   // 24 hours
} as const;

export const RedisKey = {
  refreshToken: (userId: string, tokenId: string) =>
    `refresh_token:${userId}:${tokenId}`,
  blacklistedToken: (jti: string) =>
    `blacklist:${jti}`,
  otp: (identifier: string, purpose: string) =>
    `otp:${purpose}:${identifier}`,
  otpAttempts: (identifier: string, purpose: string) =>
    `otp_attempts:${purpose}:${identifier}`,
  rateLimit: (identifier: string, action: string) =>
    `rate_limit:${action}:${identifier}`,
  userSession: (userId: string) =>
    `session:${userId}`,
  verificationToken: (token: string, purpose: string) =>
    `verify:${purpose}:${token}`,
};

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  onModuleDestroy() {
    this.redis.disconnect();
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (err: any) {
      this.logger.warn(`Redis ping failed: ${err.message}`);
      return false;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, value);
      } else {
        await this.redis.set(key, value);
      }
    } catch (err: any) {
      this.logger.warn(`Redis set failed for key ${key}: ${err.message}`);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (err: any) {
      this.logger.warn(`Redis get failed for key ${key}: ${err.message}`);
      return null;
    }
  }

  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) await this.redis.del(...keys);
    } catch (err: any) {
      this.logger.warn(`Redis del failed: ${err.message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (err: any) {
      this.logger.warn(`Redis exists failed for key ${key}: ${err.message}`);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (err: any) {
      this.logger.warn(`Redis ttl failed for key ${key}: ${err.message}`);
      return -2;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.expire(key, ttlSeconds);
    } catch (err: any) {
      this.logger.warn(`Redis expire failed for key ${key}: ${err.message}`);
    }
  }

  // Pattern operations
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.redis.keys(pattern);
    } catch (err: any) {
      this.logger.warn(`Redis keys failed for pattern ${pattern}: ${err.message}`);
      return [];
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) await this.redis.del(...keys);
      this.logger.debug(`Deleted ${keys.length} keys matching: ${pattern}`);
    } catch (err: any) {
      this.logger.warn(`Redis delByPattern failed for pattern ${pattern}: ${err.message}`);
    }
  }

  // Counter operations (for rate limiting / OTP attempts)
  async increment(key: string): Promise<number> {
    try {
      return await this.redis.incr(key);
    } catch (err: any) {
      this.logger.warn(`Redis incr failed for key ${key}: ${err.message}`);
      return 0;
    }
  }

  async incrementWithTTL(key: string, ttlSeconds: number): Promise<number> {
    try {
      const pipeline = this.redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, ttlSeconds);
      const results = await pipeline.exec();
      return results?.[0]?.[1] as number ?? 0;
    } catch (err: any) {
      this.logger.warn(`Redis incrementWithTTL failed for key ${key}: ${err.message}`);
      return 0;
    }
  }

  async hset(key: string, data: Record<string, string>): Promise<void> {
    try {
      await this.redis.hset(key, data);
    } catch (err: any) {
      this.logger.warn(`Redis hset failed for key ${key}: ${err.message}`);
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.redis.hget(key, field);
    } catch (err: any) {
      this.logger.warn(`Redis hget failed for key ${key}, field ${field}: ${err.message}`);
      return null;
    }
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    try {
      const data = await this.redis.hgetall(key);
      return Object.keys(data).length ? data : null;
    } catch (err: any) {
      this.logger.warn(`Redis hgetall failed for key ${key}: ${err.message}`);
      return null;
    }
  }

  async hdel(key: string, ...fields: string[]): Promise<void> {
    try {
      await this.redis.hdel(key, ...fields);
    } catch (err: any) {
      this.logger.warn(`Redis hdel failed: ${err.message}`);
    }
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    try {
      await this.redis.sadd(key, ...members);
    } catch (err: any) {
      this.logger.warn(`Redis sadd failed: ${err.message}`);
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.redis.smembers(key);
    } catch (err: any) {
      this.logger.warn(`Redis smembers failed for key ${key}: ${err.message}`);
      return [];
    }
  }

  async srem(key: string, ...members: string[]): Promise<void> {
    try {
      await this.redis.srem(key, ...members);
    } catch (err: any) {
      this.logger.warn(`Redis srem failed: ${err.message}`);
    }
  }

  //  HIGH-LEVEL DOMAIN METHODS
  //  These wrap the core operations with business-specific logic

  // Refresh Token cache
  async saveRefreshToken(
    userId: string,
    tokenId: string,
    hashedToken: string,
  ): Promise<void> {
    const key = RedisKey.refreshToken(userId, tokenId);
    await this.set(key, hashedToken, TTL.REFRESH_TOKEN);
    // Track all active token IDs for this user (for bulk logout)
    await this.sadd(`refresh_tokens:${userId}`, tokenId);
    await this.expire(`refresh_tokens:${userId}`, TTL.REFRESH_TOKEN);
  }

  async getRefreshToken(userId: string, tokenId: string): Promise<string | null> {
    return this.get(RedisKey.refreshToken(userId, tokenId));
  }

  async revokeRefreshToken(userId: string, tokenId: string): Promise<void> {
    await this.del(RedisKey.refreshToken(userId, tokenId));
    await this.srem(`refresh_tokens:${userId}`, tokenId);
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    const tokenIds = await this.smembers(`refresh_tokens:${userId}`);
    const keys = tokenIds.map((id) => RedisKey.refreshToken(userId, id));
    if (keys.length > 0) await this.del(...keys);
    await this.del(`refresh_tokens:${userId}`);
    this.logger.debug(`Revoked ${tokenIds.length} refresh tokens for user ${userId}`);
  }

  // Access Token blacklist (for logout before expiry)
  async blacklistAccessToken(jti: string): Promise<void> {
    await this.set(
      RedisKey.blacklistedToken(jti),
      '1',
      TTL.ACCESS_TOKEN_BLACKLIST,
    );
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    return this.exists(RedisKey.blacklistedToken(jti));
  }

  //  OTP
  async saveOtp(
    identifier: string, // email or phone
    purpose: string,    // 'email_verify' | 'password_reset' | 'login_2fa'
    otp: string,
  ): Promise<void> {
    await this.set(RedisKey.otp(identifier, purpose), otp, TTL.OTP);
  }

  async getOtp(identifier: string, purpose: string): Promise<string | null> {
    return this.get(RedisKey.otp(identifier, purpose));
  }

  async deleteOtp(identifier: string, purpose: string): Promise<void> {
    await this.del(RedisKey.otp(identifier, purpose));
  }

  async incrementOtpAttempts(
    identifier: string,
    purpose: string,
  ): Promise<number> {
    return this.incrementWithTTL(
      RedisKey.otpAttempts(identifier, purpose),
      TTL.OTP_ATTEMPTS,
    );
  }

  async getOtpAttempts(identifier: string, purpose: string): Promise<number> {
    const val = await this.get(RedisKey.otpAttempts(identifier, purpose));
    return val ? parseInt(val, 10) : 0;
  }

  async resetOtpAttempts(identifier: string, purpose: string): Promise<void> {
    await this.del(RedisKey.otpAttempts(identifier, purpose));
  }

  // ── Rate limiting ────────────────────────────────────────────────────────────
  async checkRateLimit(
    identifier: string, // IP or userId
    action: string,     // 'login' | 'register' | 'otp_request'
    maxAttempts: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const key = RedisKey.rateLimit(identifier, action);
    const attempts = await this.incrementWithTTL(key, windowSeconds);
    const resetIn = await this.ttl(key);

    return {
      allowed: attempts <= maxAttempts,
      remaining: Math.max(0, maxAttempts - attempts),
      resetIn,
    };
  }

  // ── User session (store lightweight user info to avoid DB hits) ───────────────
  async saveUserSession(
    userId: string,
    data: Record<string, string>,
  ): Promise<void> {
    const key = RedisKey.userSession(userId);
    await this.hset(key, data);
    await this.expire(key, TTL.USER_SESSION);
  }

  async getUserSession(userId: string): Promise<Record<string, string> | null> {
    return this.hgetall(RedisKey.userSession(userId));
  }

  async deleteUserSession(userId: string): Promise<void> {
    await this.del(RedisKey.userSession(userId));
  }

  // ── Verification tokens (email verify, password reset links) ─────────────────
  async saveVerificationToken(
    token: string,
    purpose: string,
    data: string, // JSON string of whatever data you need
  ): Promise<void> {
    await this.set(
      RedisKey.verificationToken(token, purpose),
      data,
      TTL.VERIFICATION_TOKEN,
    );
  }

  async getVerificationToken(
    token: string,
    purpose: string,
  ): Promise<string | null> {
    return this.get(RedisKey.verificationToken(token, purpose));
  }

  async deleteVerificationToken(token: string, purpose: string): Promise<void> {
    await this.del(RedisKey.verificationToken(token, purpose));
  }
}