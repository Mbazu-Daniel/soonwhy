import { Logger } from "@nestjs/common";
import { Redis } from "ioredis";

export const CACHE_KEY_PREFIX = "soonwhy";

export async function createRedisClient(): Promise<Redis> {
  const logger = new Logger("RedisClient");
  // lazyConnect lets us await the handshake before handing the client to Nest,
  // so commands issued during the first request can't hit the "Stream isn't
  // writeable" race. enableOfflineQueue stays false so a dead Redis fails
  // fast (commands reject, the cache is bypassed) instead of hanging requests.
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

  try {
    await client.connect();
  } catch (error) {
    logger.warn(`Redis unavailable at startup: ${error instanceof Error ? error.message : String(error)}`);
  }

  return client;
}
