import { Redis } from "ioredis";
import { requiredEnvInProduction } from "../env";

const CONNECT_TIMEOUT_MS = 2_000;

export type RedisClient = Redis;

export function createRedisClient(): RedisClient {
  return new Redis(requiredEnvInProduction("REDIS_URL", "redis://localhost:6379"), {
    maxRetriesPerRequest: 1,
    connectTimeout: CONNECT_TIMEOUT_MS,
  });
}
