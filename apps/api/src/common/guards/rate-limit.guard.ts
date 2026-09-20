import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../../redis/redis.service';
import { TenantRequest } from '../middleware/tenant-context.middleware';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const key = this.getKey(request);

    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, 60); // 1 minute window
    }

    const limit = this.getLimit(request);
    if (current > limit) {
      throw new HttpException(
        {
          type: 'rate_limit_exceeded',
          title: 'Too many requests',
          status: 429,
          detail: `Rate limit of ${limit} requests per minute exceeded`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getKey(request: TenantRequest): string {
    const userId = request.user?.id || 'anonymous';
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';
    return `rate_limit:${userId}:${ip}`;
  }

  private getLimit(request: TenantRequest): number {
    if (request.user) {
      return 100;
    }
    return 20;
  }
}
