import { Global, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ThrottlerModule, ThrottlerStorage } from "@nestjs/throttler";
import { Redis } from "ioredis";
import { describe, expect, it } from "vitest";
import { RedisThrottlerStorage } from "./redis-throttler.storage";
import { THROTTLER_ASYNC_OPTIONS } from "./throttling.module-options";

@Global()
@Module({
  providers: [{ provide: Redis, useValue: { eval: async () => [1, 1000, 0, 0] } }],
  exports: [Redis],
})
class FakeRedisModule {}

@Module({
  imports: [FakeRedisModule, ThrottlerModule.forRootAsync(THROTTLER_ASYNC_OPTIONS)],
})
class RootModule {}

describe("throttler module wiring", () => {
  it("stores request counts in Redis through the global Redis provider", async () => {
    const app = await NestFactory.createApplicationContext(RootModule, { logger: false });
    try {
      expect(app.get(ThrottlerStorage)).toBeInstanceOf(RedisThrottlerStorage);
    } finally {
      await app.close();
    }
  });
});
