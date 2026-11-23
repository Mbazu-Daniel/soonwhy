import { describe, expect, it, vi } from "vitest";
import { RECONCILE_CHUNK_SIZE } from "./constants";
import { findExistingEventIds, lookupRange } from "./reconciler";

const row = (id: string, timestamp: unknown = "2026-11-21T12:00:00.000Z") => ({ eventId: id, timestamp });

describe("lookupRange", () => {
  it("covers the earliest to the latest row, with an exclusive end one second after the latest", () => {
    const range = lookupRange([row("a", "2026-11-21T12:00:05.900Z"), row("b", "2026-11-21T12:00:01.100Z")]);

    expect(range).toEqual({
      startTimestamp: Date.UTC(2026, 10, 21, 12, 0, 1) / 1000,
      endTimestamp: Date.UTC(2026, 10, 21, 12, 0, 5) / 1000 + 1,
    });
  });

  it("returns no bound when any timestamp is missing or unreadable, so the lookup stays correct", () => {
    expect(lookupRange([row("a"), { eventId: "b" }])).toBeUndefined();
    expect(lookupRange([row("a", "not a date")])).toBeUndefined();
    expect(lookupRange([])).toBeUndefined();
  });
});

describe("findExistingEventIds", () => {
  it("queries in chunks of 500 ids and merges the answers", async () => {
    const rows = Array.from({ length: 1_200 }, (_, i) => row(`id-${i}`));
    const findEventIds = vi.fn(async (_index: string, ids: string[]) => new Set(ids.filter((id) => Number(id.slice(3)) % 2 === 0)));

    const found = await findExistingEventIds({ findEventIds }, "telemetry-logs", rows);

    expect(findEventIds.mock.calls.map((call) => call[1].length)).toEqual([RECONCILE_CHUNK_SIZE, RECONCILE_CHUNK_SIZE, 200]);
    expect(found.size).toBe(600);
  });

  it("bounds each chunk by its own timestamp range", async () => {
    const findEventIds = vi.fn(async () => new Set<string>());
    const rows = [
      ...Array.from({ length: RECONCILE_CHUNK_SIZE }, (_, i) => row(`early-${i}`, "2026-11-21T12:00:00.000Z")),
      row("late", "2026-11-21T13:00:00.000Z"),
    ];

    await findExistingEventIds({ findEventIds }, "telemetry-logs", rows);

    const ranges = findEventIds.mock.calls.map((call) => (call as unknown[])[2]);
    expect(ranges[0]).toEqual({ startTimestamp: Date.UTC(2026, 10, 21, 12) / 1000, endTimestamp: Date.UTC(2026, 10, 21, 12) / 1000 + 1 });
    expect(ranges[1]).toEqual({ startTimestamp: Date.UTC(2026, 10, 21, 13) / 1000, endTimestamp: Date.UTC(2026, 10, 21, 13) / 1000 + 1 });
  });

  it("lets a failing lookup propagate so the caller can refuse to write", async () => {
    const findEventIds = vi.fn().mockRejectedValue(new Error("search down"));

    await expect(findExistingEventIds({ findEventIds }, "telemetry-logs", [row("a")])).rejects.toThrow("search down");
  });

  it("does not query for no rows", async () => {
    const findEventIds = vi.fn();

    expect((await findExistingEventIds({ findEventIds }, "telemetry-logs", [])).size).toBe(0);
    expect(findEventIds).not.toHaveBeenCalled();
  });
});
