import { describe, expect, it, vi } from "vitest";
import { FakeCanaryStore } from "./support/fake-canary-store";
import { VisibilityCanary } from "../src/pipeline/visibility-canary";

const LEASE = 150_000;
const searchable = (ids: string[]) => ({ findEventIds: vi.fn(async (_i: string, q: string[]) => new Set(q.filter((id) => ids.includes(id)))) });

describe("visibility canary", () => {
  it("does not judge before a canary is older than the lease", async () => {
    const canary = new VisibilityCanary(new FakeCanaryStore());
    await canary.record("idx", "a", 1_000);

    expect(await canary.indexerIsBehind(searchable([]), "idx", LEASE, 1_000 + LEASE - 1)).toBe(false);
  });

  it("has no opinion without any recorded write", async () => {
    expect(await new VisibilityCanary(new FakeCanaryStore()).indexerIsBehind(searchable([]), "idx", LEASE, 9_999_999)).toBe(false);
  });

  it("reports behind when an old enough canary is not searchable", async () => {
    const canary = new VisibilityCanary(new FakeCanaryStore());
    await canary.record("idx", "a", 0);

    expect(await canary.indexerIsBehind(searchable([]), "idx", LEASE, LEASE + 1)).toBe(true);
  });

  it("reports caught up when it is searchable, and drops verified canaries", async () => {
    const canary = new VisibilityCanary(new FakeCanaryStore());
    const quickwit = searchable(["a"]);
    await canary.record("idx", "a", 0);

    expect(await canary.indexerIsBehind(quickwit, "idx", LEASE, LEASE + 1)).toBe(false);
    await canary.indexerIsBehind(quickwit, "idx", LEASE, LEASE + 2);
    expect(quickwit.findEventIds).toHaveBeenCalledOnce();
  });

  it("keeps indexes separate", async () => {
    const canary = new VisibilityCanary(new FakeCanaryStore());
    await canary.record("one", "a", 0);

    expect(await canary.indexerIsBehind(searchable([]), "two", LEASE, LEASE + 1)).toBe(false);
  });

  it("keeps only the five most recent canaries per index", async () => {
    const store = new FakeCanaryStore();
    const canary = new VisibilityCanary(store);
    for (let i = 0; i < 8; i++) await canary.record("idx", `e${i}`, i);

    expect((await store.zrangebyscore("ingest:canary:idx", "-inf", "+inf", "WITHSCORES")).length).toBe(10);
  });

  it("does not fail a write when recording the canary fails", async () => {
    const store = new FakeCanaryStore();
    store.failing = true;

    await expect(new VisibilityCanary(store).record("idx", "a", 0)).resolves.toBeUndefined();
  });

  it("lets a store failure propagate when checking, so the caller fails closed", async () => {
    const store = new FakeCanaryStore();
    store.failing = true;

    await expect(new VisibilityCanary(store).indexerIsBehind(searchable([]), "idx", LEASE, LEASE + 1)).rejects.toThrow("redis is down");
  });
});
