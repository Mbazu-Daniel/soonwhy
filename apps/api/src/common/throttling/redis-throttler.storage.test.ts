import { describe, expect, it, vi } from "vitest";
import { Redis } from "ioredis";
import { RedisThrottlerStorage } from "./redis-throttler.storage";

function fakeRedis(result: unknown) {
  return { eval: vi.fn().mockResolvedValue(result) };
}

describe("RedisThrottlerStorage with a reachable Redis", () => {
  it("passes the window, limit and block time to the script and maps the reply", async () => {
    const redis = fakeRedis([3, 4200, 0, 0]);
    const storage = new RedisThrottlerStorage(redis as never);

    const record = await storage.increment("abc", 60_000, 10, 60_000, "sustained");

    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      2,
      "soonwhy:throttle:sustained:abc",
      "soonwhy:throttle:sustained:abc:blocked",
      60_000,
      10,
      60_000,
    );
    expect(record).toEqual({
      totalHits: 3,
      timeToExpire: 5,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it("reports a block with the time left in seconds", async () => {
    const storage = new RedisThrottlerStorage(fakeRedis([11, 800, 1, 59_100]) as never);

    const record = await storage.increment("abc", 1_000, 10, 60_000, "burst");

    expect(record.isBlocked).toBe(true);
    expect(record.timeToBlockExpire).toBe(60);
  });
});

describe("RedisThrottlerStorage when Redis is down", () => {
  it("keeps limiting inside the process instead of failing the request", async () => {
    const redis = { eval: vi.fn().mockRejectedValue(new Error("connection refused")) };
    const storage = new RedisThrottlerStorage(redis as never);

    const first = await storage.increment("abc", 60_000, 2, 60_000, "sustained");
    const second = await storage.increment("abc", 60_000, 2, 60_000, "sustained");
    const third = await storage.increment("abc", 60_000, 2, 60_000, "sustained");

    expect(first.isBlocked).toBe(false);
    expect(second.isBlocked).toBe(false);
    expect(third.isBlocked).toBe(true);
  });

  it("goes back to Redis as soon as it answers again", async () => {
    const redis = {
      eval: vi
        .fn()
        .mockRejectedValueOnce(new Error("down"))
        .mockResolvedValue([1, 1_000, 0, 0]),
    };
    const storage = new RedisThrottlerStorage(redis as never);

    await storage.increment("abc", 1_000, 5, 1_000, "burst");
    const record = await storage.increment("abc", 1_000, 5, 1_000, "burst");

    expect(redis.eval).toHaveBeenCalledTimes(2);
    expect(record.totalHits).toBe(1);
  });
});

const redisUrl = process.env.REDIS_TEST_URL;

describe.skipIf(!redisUrl)("RedisThrottlerStorage against a real Redis", () => {
  const client = redisUrl ? new Redis(redisUrl) : (undefined as never);
  const name = `t${Date.now()}`;

  it("counts hits inside the window and blocks above the limit", async () => {
    const storage = new RedisThrottlerStorage(client);
    const results = [];
    for (let i = 0; i < 4; i += 1) {
      results.push(await storage.increment("real", 5_000, 3, 5_000, name));
    }
    expect(results.map((r) => r.isBlocked)).toEqual([false, false, false, true]);
    expect(results[0]!.totalHits).toBe(1);
    expect(results[3]!.timeToBlockExpire).toBeGreaterThan(0);
  });

  it("shares the count between two instances", async () => {
    const a = new RedisThrottlerStorage(client);
    const b = new RedisThrottlerStorage(client);
    await a.increment("shared", 5_000, 2, 5_000, name);
    await b.increment("shared", 5_000, 2, 5_000, name);
    const third = await a.increment("shared", 5_000, 2, 5_000, name);
    expect(third.isBlocked).toBe(true);
  });

  it("opens a fresh window after the block ends", async () => {
    const storage = new RedisThrottlerStorage(client);
    await storage.increment("expiry", 300, 1, 300, name);
    const blocked = await storage.increment("expiry", 300, 1, 300, name);
    expect(blocked.isBlocked).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 450));
    const fresh = await storage.increment("expiry", 300, 1, 300, name);
    expect(fresh.isBlocked).toBe(false);
    expect(fresh.totalHits).toBe(1);
  });
});
