import { Global, Module, OnApplicationShutdown, Inject } from "@nestjs/common";
import { Redis } from "ioredis";
import { CacheService } from "./cache.service";
import { RedisIdempotencyStore } from "../idempotency/redis-idempotency.store";
import { createRedisClient } from "./cache.factory";

@Global()
@Module({
  providers: [
    RedisIdempotencyStore,
    {
      provide: Redis,
      useFactory: createRedisClient,
    },
    CacheService,
  ],
  exports: [Redis, CacheService, RedisIdempotencyStore],
})
export class CacheModule implements OnApplicationShutdown {
  constructor(@Inject(Redis) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
