import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lockResult = { locked: true };
const transaction = vi.fn(async (run: (tx: unknown) => Promise<void>) => {
  await run({ execute: vi.fn().mockResolvedValue([lockResult]) });
});

vi.mock("../db", () => ({ db: { transaction: (run: (tx: unknown) => Promise<void>) => transaction(run) } }));

import { CronLeaseService } from "./cron-lease.service";

function fakeRedis(overrides: Record<string, unknown> = {}) {
  return { set: vi.fn().mockResolvedValue("OK"), eval: vi.fn().mockResolvedValue(1), ...overrides };
}

describe("CronLeaseService", () => {
  beforeEach(() => {
    lockResult.locked = true;
    transaction.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("runs the job under the Redis lease and releases it", async () => {
    const redis = fakeRedis();
    const fn = vi.fn().mockResolvedValue(undefined);

    const ran = await new CronLeaseService(redis as never).runExclusive("job", 60_000, fn);

    expect(ran).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("skips the job when another instance holds the lease", async () => {
    const redis = fakeRedis({ set: vi.fn().mockResolvedValue(null) });
    const fn = vi.fn();

    expect(await new CronLeaseService(redis as never).runExclusive("job", 60_000, fn)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it("renews the lease while a long job is still running", async () => {
    vi.useFakeTimers();
    const redis = fakeRedis();
    const job = new CronLeaseService(redis as never).runExclusive("job", 30_000, () => new Promise<void>((resolve) => setTimeout(resolve, 25_000)));

    await vi.advanceTimersByTimeAsync(25_000);
    await job;

    const renewals = redis.eval.mock.calls.filter((call) => String(call[0]).includes("pexpire"));
    expect(renewals.length).toBeGreaterThanOrEqual(2);
  });

  it("takes a database lock instead of running unguarded when Redis fails", async () => {
    const redis = fakeRedis({ set: vi.fn().mockRejectedValue(new Error("redis down")) });
    const fn = vi.fn().mockResolvedValue(undefined);

    expect(await new CronLeaseService(redis as never).runExclusive("job", 60_000, fn)).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("skips the job when the database lock is held elsewhere", async () => {
    lockResult.locked = false;
    const fn = vi.fn();

    expect(await new CronLeaseService(undefined).runExclusive("job", 60_000, fn)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it("skips the job when the database lock cannot be taken", async () => {
    transaction.mockRejectedValueOnce(new Error("db down"));
    const fn = vi.fn();

    expect(await new CronLeaseService(undefined).runExclusive("job", 60_000, fn)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it("passes the job's own error through the database lock path", async () => {
    await expect(
      new CronLeaseService(undefined).runExclusive("job", 60_000, () => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");
  });
});
