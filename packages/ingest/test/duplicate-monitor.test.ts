import { QUICKWIT_INDEXES } from "@soonwhy/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AlertNotifier } from "../src/pipeline/alert-notifier";
import { ClaimLease } from "../src/pipeline/claim-lease";
import { DuplicateMonitor } from "../src/pipeline/duplicate-monitor";
import { IngestStats } from "../src/pipeline/stats";

const NOW = Date.UTC(2026, 10, 21, 12, 0, 0);
const clean = { documents: 10, duplicateEventIds: 0, extraCopies: 0, truncated: false };

function build(duplicateReport: ReturnType<typeof vi.fn>) {
  const stats = new IngestStats();
  const notifier = { notify: vi.fn().mockResolvedValue(true) };
  const lease = new ClaimLease();
  const monitor = new DuplicateMonitor({ duplicateReport } as never, stats, lease, notifier as unknown as AlertNotifier);
  return { monitor, stats, notifier, lease };
}

afterEach(() => {
  delete process.env.INGEST_DUPLICATE_WINDOW_SECS;
  delete process.env.INGEST_DUPLICATE_CHECK_INTERVAL_MS;
});

describe("duplicate monitor", () => {
  it("checks every index over a window that ends one lease ago, so in-flight writes are not counted", async () => {
    const duplicateReport = vi.fn().mockResolvedValue(clean);
    const { monitor, lease } = build(duplicateReport);

    await monitor.checkAll(NOW);

    const end = Math.floor((NOW - lease.ms) / 1000);
    expect(duplicateReport).toHaveBeenCalledTimes(Object.values(QUICKWIT_INDEXES).length);
    expect(duplicateReport.mock.calls[0][1]).toEqual({ startTimestamp: end - 3600, endTimestamp: end });
  });

  it("publishes each index's result in the stats snapshot", async () => {
    const { monitor, stats } = build(vi.fn().mockResolvedValue(clean));

    await monitor.checkAll(NOW);

    const status = stats.snapshot().sinkDuplicates[QUICKWIT_INDEXES.logs];
    expect(status).toMatchObject({ documents: 10, duplicateEventIds: 0, checkedAt: new Date(NOW).toISOString() });
  });

  it("alerts when duplicates exist, naming the index and the counts", async () => {
    const duplicateReport = vi.fn().mockImplementation(async (indexId: string) =>
      indexId === QUICKWIT_INDEXES.logs ? { documents: 10, duplicateEventIds: 2, extraCopies: 3, truncated: false } : clean,
    );
    const { monitor, notifier } = build(duplicateReport);

    await monitor.checkAll(NOW);

    expect(notifier.notify).toHaveBeenCalledOnce();
    expect(notifier.notify.mock.calls[0][0]).toBe(`sink_duplicates:${QUICKWIT_INDEXES.logs}`);
    expect(notifier.notify.mock.calls[0][1]).toContain("2 event ids");
    expect(notifier.notify.mock.calls[0][1]).toContain("3 extra copies");
  });

  it("says at least when the report was truncated", async () => {
    const { monitor, notifier } = build(vi.fn().mockResolvedValue({ documents: 9, duplicateEventIds: 1000, extraCopies: 1000, truncated: true }));

    await monitor.checkAll(NOW);

    expect(notifier.notify.mock.calls[0][1]).toContain("at least 1000");
  });

  it("does not alert for a clean window", async () => {
    const { monitor, notifier } = build(vi.fn().mockResolvedValue(clean));

    await monitor.checkAll(NOW);

    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it("keeps checking the other indexes when one check fails, and records nothing for the failed one", async () => {
    const duplicateReport = vi.fn().mockImplementation(async (indexId: string) => {
      if (indexId === QUICKWIT_INDEXES.logs) throw new Error("search down");
      return clean;
    });
    const { monitor, stats } = build(duplicateReport);

    await monitor.checkAll(NOW);

    expect(stats.snapshot().sinkDuplicates[QUICKWIT_INDEXES.logs]).toBeUndefined();
    expect(Object.keys(stats.snapshot().sinkDuplicates)).toHaveLength(Object.values(QUICKWIT_INDEXES).length - 1);
  });

  it("uses a configured window", async () => {
    process.env.INGEST_DUPLICATE_WINDOW_SECS = "600";
    const duplicateReport = vi.fn().mockResolvedValue(clean);
    const { monitor, lease } = build(duplicateReport);

    await monitor.checkAll(NOW);

    const end = Math.floor((NOW - lease.ms) / 1000);
    expect(duplicateReport.mock.calls[0][1]).toEqual({ startTimestamp: end - 600, endTimestamp: end });
  });

  it("does not schedule checks when the interval is 0", () => {
    process.env.INGEST_DUPLICATE_CHECK_INTERVAL_MS = "0";
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const { monitor } = build(vi.fn());

    monitor.onModuleInit();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });
});
