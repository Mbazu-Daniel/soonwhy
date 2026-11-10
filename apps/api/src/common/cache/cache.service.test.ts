import { describe, expect, it, vi } from "vitest";
import { CacheService } from "./cache.service";

function redisStub(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    scan: vi.fn(),
    ping: vi.fn(),
    ...overrides,
  };
}

describe("CacheService", () => {
  it("returns a parsed value for a cache hit", async () => {
    const redis = redisStub({
      get: vi.fn().mockResolvedValue(JSON.stringify({ score: 9 })),
    });
    const cache = new CacheService(redis as never);

    await expect(cache.getJson("overview:org-1")).resolves.toEqual({ score: 9 });
    expect(redis.get).toHaveBeenCalledWith("soonwhy:overview:org-1");
  });

  it("returns null for a cache miss", async () => {
    const redis = redisStub({ get: vi.fn().mockResolvedValue(null) });
    const cache = new CacheService(redis as never);

    await expect(cache.getJson("missing")).resolves.toBeNull();
  });

  it("degrades to a miss when redis fails", async () => {
    const redis = redisStub({
      get: vi.fn().mockRejectedValue(new Error("connection refused")),
    });
    const cache = new CacheService(redis as never);

    await expect(cache.getJson("overview")).resolves.toBeNull();
  });

  it("writes values with the configured ttl", async () => {
    const redis = redisStub({ setex: vi.fn().mockResolvedValue("OK") });
    const cache = new CacheService(redis as never);

    await cache.setJson("overview", { score: 9 }, 30);

    expect(redis.setex).toHaveBeenCalledWith(
      "soonwhy:overview",
      30,
      JSON.stringify({ score: 9 }),
    );
  });

  it("does not write values with a non-positive ttl", async () => {
    const redis = redisStub();
    const cache = new CacheService(redis as never);

    await cache.setJson("overview", { score: 9 }, 0);

    expect(redis.setex).not.toHaveBeenCalled();
  });

  it("loads and caches a value on a miss", async () => {
    const redis = redisStub({
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue("OK"),
    });
    const cache = new CacheService(redis as never);

    const value = await cache.getOrSet("overview", 30, async () => ({ score: 9 }));

    expect(value).toEqual({ score: 9 });
    expect(redis.setex).toHaveBeenCalledWith(
      "soonwhy:overview",
      30,
      JSON.stringify({ score: 9 }),
    );
  });

  it("returns a cached value without invoking the loader", async () => {
    const redis = redisStub({
      get: vi.fn().mockResolvedValue(JSON.stringify({ score: 8 })),
    });
    const cache = new CacheService(redis as never);
    const load = vi.fn().mockResolvedValue({ score: 9 });

    await expect(cache.getOrSet("overview", 30, load)).resolves.toEqual({ score: 8 });
    expect(load).not.toHaveBeenCalled();
  });

  it("deletes every key returned by SCAN under a prefix", async () => {
    const redis = redisStub({
      scan: vi
        .fn()
        .mockResolvedValueOnce(["7", ["soonwhy:overview:1", "soonwhy:overview:2"]])
        .mockResolvedValueOnce(["0", []]),
      del: vi.fn().mockResolvedValue(2),
    });
    const cache = new CacheService(redis as never);

    await expect(cache.deleteByPrefix("overview")).resolves.toBe(2);
    expect(redis.scan).toHaveBeenCalledWith("0", "MATCH", "soonwhy:overview*", "COUNT", 100);
    expect(redis.del).toHaveBeenCalledWith("soonwhy:overview:1", "soonwhy:overview:2");
  });

  it("reports redis health and latency", async () => {
    const redis = redisStub({ ping: vi.fn().mockResolvedValue("PONG") });
    const cache = new CacheService(redis as never);

    await expect(cache.health()).resolves.toMatchObject({ status: "ok" });
  });

  it("reports redis errors as unavailable", async () => {
    const redis = redisStub({ ping: vi.fn().mockRejectedValue(new Error("down")) });
    const cache = new CacheService(redis as never);

    await expect(cache.health()).resolves.toMatchObject({
      status: "unavailable",
      error: "down",
    });
  });
});
