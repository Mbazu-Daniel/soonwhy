import { Global, Module, OnApplicationShutdown, Inject } from "@nestjs/common";
import { Redis } from "ioredis";
import { CacheService } from "./cache.service";
import { createRedisClient } from "./cache.factory";

@Global()
@Module({
  providers: [
    {
      provide: Redis,
      useFactory: createRedisClient,
    },
    CacheService,
  ],
  exports: [Redis, CacheService],
})
export class CacheModule implements OnApplicationShutdown {
  constructor(@Inject(Redis) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
