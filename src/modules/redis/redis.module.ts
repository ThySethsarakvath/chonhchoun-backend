import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

const RedisClientProvider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Redis => {
    const client = new Redis({
      host: config.get<string>('redis.host', 'localhost'),
      port: config.get<number>('redis.port', 6379),
      password: config.get<string>('redis.password') || undefined,
      db: 0,
      lazyConnect: false,
      retryStrategy: (times: number) => {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
    });

    client.on('connect', () => console.log('[Redis] ✅ Connected successfully'));
    client.on('error', (err: Error) => console.error('[Redis] ❌ Error:', err.message));

    return client;
  },
};

@Global()
@Module({
  providers: [RedisClientProvider, RedisService],
  exports: [RedisService],
})
export class RedisModule {}