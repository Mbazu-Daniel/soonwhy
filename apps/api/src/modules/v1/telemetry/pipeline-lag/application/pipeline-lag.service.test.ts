import { describe, expect, it, vi } from "vitest";
import { PipelineLagService } from "./pipeline-lag.service";

describe("PipelineLagService", () => {
  it("reports lag from the newest _source timestamp across telemetry indexes", async () => {
    const timestamp = new Date(Date.now() - 5000).toISOString();
    const quickwit = {
      search: vi.fn().mockResolvedValue({
        hits: [{ _source: { timestamp } }],
        num_hits: 1,
      }),
    };
    const health = {
      getSnapshot: vi.fn().mockResolvedValue({
        available: true,
        consumers: [
          { pending: 3, ackPending: 1 },
          { pending: 2, ackPending: 0 },
        ],
        stats: {},
        capacity: null,
      }),
    };
    const service = new PipelineLagService(
      quickwit as never,
      health as never,
    );

    const metrics = await service.getLagMetrics();

    expect(metrics.quickwitIndexingLagMs).toBeGreaterThanOrEqual(4000);
    expect(metrics.quickwitPendingDocs).toBe(5);
    expect(quickwit.search).toHaveBeenCalledWith(
      "telemetry-logs",
      expect.any(Object),
    );
  });

  it("returns zero lag when the indexes are empty", async () => {
    const quickwit = {
      search: vi.fn().mockResolvedValue({ hits: [], num_hits: 0 }),
    };
    const health = {
      getSnapshot: vi.fn().mockResolvedValue({
        available: true,
        consumers: [],
        stats: {},
        capacity: null,
      }),
    };
    const service = new PipelineLagService(
      quickwit as never,
      health as never,
    );

    const metrics = await service.getLagMetrics();

    expect(metrics.quickwitIndexingLagMs).toBe(0);
    expect(metrics.quickwitPendingDocs).toBe(0);
  });
});
