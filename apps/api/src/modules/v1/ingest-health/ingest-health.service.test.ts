import { afterEach, describe, expect, it, vi } from "vitest";
import { IngestHealthService } from "./ingest-health.service";

const snapshot = {
  stats: {
    accepted: 10,
    rejected: 1,
    published: 10,
    inserted: 9,
    duplicates: 1,
    dlq: 0,
    errors: 0,
    averageLatencyMs: 4,
    eventsPerSecond: 1,
    inFlight: 0,
    peakInFlight: 2,
  },
  capacity: {
    limit: 100,
    perOrganizationLimit: 25,
    inFlight: 0,
    available: 100,
    isSaturated: false,
    organizations: 0,
  },
  consumers: [
    { subject: "ingest.*.log", durable: "ingest-log", pending: 2, ackPending: 1, redelivered: 0 },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("IngestHealthService", () => {
  it("reads the ingest worker snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => snapshot }),
    );
    const service = new IngestHealthService();

    const result = await service.getSnapshot();

    expect(result.available).toBe(true);
    expect(result.stats.inserted).toBe(9);
    expect(result.consumers[0]?.pending).toBe(2);
  });

  it("reports unavailable when the worker cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const service = new IngestHealthService();

    const result = await service.getSnapshot();

    expect(result.available).toBe(false);
    expect(result.error).toBe("offline");
    expect(result.stats.accepted).toBe(0);
  });
});
