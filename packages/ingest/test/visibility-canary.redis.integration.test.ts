import { createRedisClient, type RedisClient } from "@soonwhy/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { VisibilityCanary } from "../src/pipeline/visibility-canary";

const redisUrl = process.env.REDIS_TEST_URL;
const LEASE = 150_000;

describe.skipIf(!redisUrl)("visibility canary on a real Redis", () => {
  let redis: RedisClient;
  const index = `test-${Date.now()}`;
  const searchable = (ids: string[]) => ({ findEventIds: vi.fn(async (_i: string, q: string[]) => new Set(q.filter((id) => ids.includes(id)))) });

  beforeAll(() => {
    process.env.REDIS_URL = redisUrl;
    redis = createRedisClient();
  });

  beforeEach(async () => {
    await redis.del(`ingest:canary:${index}`);
  });

  afterAll(async () => {
    await redis.del(`ingest:canary:${index}`);
    await redis.quit();
  });

  it("survives a restart: a new instance sees what an old one recorded", async () => {
    await new VisibilityCanary(redis).record(index, "a", 0);
    const restarted = new VisibilityCanary(redis);

    expect(await restarted.indexerIsBehind(searchable([]), index, LEASE, LEASE + 1)).toBe(true);
    expect(await restarted.indexerIsBehind(searchable(["a"]), index, LEASE, LEASE + 1)).toBe(false);
  });

  it("is shared between two consumers", async () => {
    await new VisibilityCanary(redis).record(index, "a", 0);

    expect(await new VisibilityCanary(redis).indexerIsBehind(searchable([]), index, LEASE, LEASE + 1)).toBe(true);
  });

  it("trims to five and clears verified canaries", async () => {
    const canary = new VisibilityCanary(redis);
    for (let i = 0; i < 8; i++) await canary.record(index, `e${i}`, i);
    expect(await redis.zcard(`ingest:canary:${index}`)).toBe(5);

    expect(await canary.indexerIsBehind(searchable(["e7"]), index, LEASE, LEASE + 100)).toBe(false);
    expect(await redis.zcard(`ingest:canary:${index}`)).toBe(0);
  });

  it("expires so a dead index does not keep a canary forever", async () => {
    await new VisibilityCanary(redis).record(index, "a", 0);

    expect(await redis.ttl(`ingest:canary:${index}`)).toBeGreaterThan(0);
  });
});
