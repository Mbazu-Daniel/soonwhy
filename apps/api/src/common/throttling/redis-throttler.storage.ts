import { Logger } from "@nestjs/common";
import {
  ThrottlerStorageService,
  type ThrottlerStorage,
} from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import type { Redis } from "ioredis";
import { THROTTLE_SCRIPT } from "./redis-throttler.script";

function seconds(milliseconds: number): number {
  return Math.max(0, Math.ceil(milliseconds / 1000));
}

export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly fallback = new ThrottlerStorageService();
  private degraded = false;

  constructor(private readonly redis: Pick<Redis, "eval">) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `soonwhy:throttle:${throttlerName}:${key}`;
    try {
      const [hits, ttlMs, blocked, blockMs] = (await this.redis.eval(
        THROTTLE_SCRIPT,
        2,
        hitsKey,
        `${hitsKey}:blocked`,
        ttl,
        limit,
        blockDuration,
      )) as [number, number, number, number];
      this.recovered();
      return {
        totalHits: hits,
        timeToExpire: seconds(ttlMs),
        isBlocked: blocked === 1,
        timeToBlockExpire: blocked === 1 ? seconds(blockMs) : 0,
      };
    } catch (error) {
      this.degrade(error);
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }
  }

  private degrade(error: unknown): void {
    if (this.degraded) return;
    this.degraded = true;
    const reason = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Redis unavailable, limiting per process until it returns: ${reason}`);
  }

  private recovered(): void {
    if (!this.degraded) return;
    this.degraded = false;
    this.logger.log("Redis available again, limits are shared across processes");
  }
}
