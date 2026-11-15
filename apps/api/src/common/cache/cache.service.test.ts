import { describe, expect, it, vi } from "vitest";
import { CacheService, jitteredTtl } from "./cache.service";

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
      expect.any(Number),
      JSON.stringify({ score: 9 }),
    );
    const ttl = redis.setex.mock.calls[0]![1] as number;
    expect(ttl).toBeGreaterThanOrEqual(27);
    expect(ttl).toBeLessThanOrEqual(33);
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
      expect.any(Number),
      JSON.stringify({ score: 9 }),
    );
    const ttl = redis.setex.mock.calls[0]![1] as number;
    expect(ttl).toBeGreaterThanOrEqual(27);
    expect(ttl).toBeLessThanOrEqual(33);
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

  it("runs the loader once when many callers miss the same key at the same time", async () => {
    const redis = redisStub({ get: vi.fn().mockResolvedValue(null), setex: vi.fn().mockResolvedValue("OK") });
    const cache = new CacheService(redis as never);
    let release: (value: string) => void = () => undefined;
    const load = vi.fn().mockImplementation(() => new Promise<string>((resolve) => { release = resolve; }));

    const calls = Promise.all([1, 2, 3, 4, 5].map(() => cache.getOrSet("overview", 60, load)));
    await new Promise((resolve) => setTimeout(resolve, 5));
    release("value");

    await expect(calls).resolves.toEqual(Array(5).fill("value"));
    expect(load).toHaveBeenCalledTimes(1);
    expect(redis.setex).toHaveBeenCalledTimes(1);
  });

  it("lets the next call load again after a failed load", async () => {
    const redis = redisStub({ get: vi.fn().mockResolvedValue(null), setex: vi.fn().mockResolvedValue("OK") });
    const cache = new CacheService(redis as never);
    const load = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce("ok");

    await expect(cache.getOrSet("k", 60, load)).rejects.toThrow("down");
    await expect(cache.getOrSet("k", 60, load)).resolves.toBe("ok");
  });
});

describe("jitteredTtl", () => {
  it("stays within ten percent of the ttl and never below one second", () => {
    expect(jitteredTtl(100, () => 0)).toBe(90);
    expect(jitteredTtl(100, () => 0.999)).toBe(110);
    expect(jitteredTtl(1)).toBe(1);
    expect(jitteredTtl(5, () => 0)).toBeGreaterThanOrEqual(1);
  });
});
