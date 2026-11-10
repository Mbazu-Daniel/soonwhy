import { Logger } from "@nestjs/common";
import { Redis } from "ioredis";

export const CACHE_KEY_PREFIX = "soonwhy";

export function createRedisClient(): Redis {
  const logger = new Logger("RedisClient");
  const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    retryStrategy: (attempt) => (attempt > 3 ? null : Math.min(attempt * 200, 1_000)),
  });

  client.on("error", (error: Error) => {
    logger.warn(`Redis unavailable: ${error.message}`);
  });

  return client;
}
