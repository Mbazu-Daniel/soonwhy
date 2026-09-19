import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RateLimiter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimiter.name);
  private redis: Redis;
  private rateLimitPerMinute: number;
  private connected = false;

  constructor() {
    const configuredLimit = Number.parseInt(
      process.env.RATE_LIMIT_PER_MINUTE || '10000',
      10,
    );
    if (!Number.isSafeInteger(configuredLimit) || configuredLimit <= 0) {
      throw new Error('RATE_LIMIT_PER_MINUTE must be a positive integer');
    }

    this.rateLimitPerMinute = configuredLimit;
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    this.redis.on('error', (error: Error) =>
      this.logger.error('Rate limiter Redis error', error),
    );
  }

  async onModuleInit() {
    try {
      await this.redis.connect();
      this.connected = true;
      this.logger.log('Rate limiter Redis connected');
    } catch (error) {
      this.logger.warn('Rate limiter Redis unavailable; fail-open', error as Error);
      this.connected = false;
    }
  }

  async onModuleDestroy() {
    if (this.connected) {
      await this.redis.quit();
    }
  }

  async checkRateLimit(organizationId: string): Promise<boolean> {
    if (!this.connected) return true;

    const minute = Math.floor(Date.now() / 60_000);
    const key = `otel:rate:${organizationId}:${minute}`;
    try {
      const result = await this.redis.multi().incr(key).expire(key, 120).exec();
      const count = Number(result?.[0]?.[1] || 0);
      return count <= this.rateLimitPerMinute;
    } catch {
      return true;
    }
  }
}
