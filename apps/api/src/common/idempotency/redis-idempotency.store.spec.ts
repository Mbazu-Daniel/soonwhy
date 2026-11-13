import { describe, it, beforeAll, afterAll } from "vitest";
import { Redis } from "ioredis";
import { idempotencyStoreContract } from "@nestjs/idempotency/testing";
import { RedisIdempotencyStore } from "./redis-idempotency.store";

const REDIS_URL = process.env.REDIS_URL;
const describeIfRedis = REDIS_URL ? describe : describe.skip;

function noopIdempotencyStorage() {
  return { registerSource: () => undefined } as never;
}

let redis: Redis | undefined;
let store: RedisIdempotencyStore | undefined;

const contractCases = REDIS_URL
  ? idempotencyStoreContract(() => store!, {
      lockTtl: 600,
      concurrent: true,
    })
  : [];

describeIfRedis("RedisIdempotencyStore (live Redis at REDIS_URL)", () => {
  beforeAll(async () => {
    redis = new Redis(REDIS_URL!, { lazyConnect: true, maxRetriesPerRequest: 1 });
    redis.on("error", () => undefined);
    try {
      await redis.connect();
      await redis.ping();
    } catch (cause) {
      throw new Error(
        `REDIS_URL is set (${REDIS_URL}) but the server is unreachable: ${String(cause)}`,
      );
    }
    store = new RedisIdempotencyStore(redis, noopIdempotencyStorage());
  });

  afterAll(async () => {
    await redis?.quit();
  });

  for (const contractCase of contractCases) {
    it(contractCase.name, async () => {
      await contractCase.run();
    }, 15_000);
  }
});
