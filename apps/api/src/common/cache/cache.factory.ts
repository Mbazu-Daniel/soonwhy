import { Logger } from "@nestjs/common";
import { requiredEnvInProduction } from "@soonwhy/shared";
import { Redis } from "ioredis";

export async function createRedisClient(): Promise<Redis> {
  const logger = new Logger("RedisClient");

  const client = new Redis(
    requiredEnvInProduction("REDIS_URL", "redis://localhost:6379"),
    {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      retryStrategy: (attempt) => (attempt > 3 ? null : Math.min(attempt * 200, 1_000)),
    },
  );

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
