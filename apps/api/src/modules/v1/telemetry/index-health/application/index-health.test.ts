import { describe, expect, it, vi } from "vitest";
import { indexStatus, summarizeSplits, toIndexHealth, unavailableIndex } from "../domain/index-health";
import { IndexHealthService } from "./index-health.service";

const now = new Date("2026-11-14T12:00:00Z");
const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const description = (overrides = {}) => ({
  index_id: "telemetry-logs",
  num_published_splits: 2,
  size_published_splits: 5000,
  num_published_docs: 120,
  size_published_docs_uncompressed: 20000,
  min_timestamp: at("2026-11-10T00:00:00Z"),
  max_timestamp: at("2026-11-14T11:30:00Z"),
  ...overrides,
});

describe("summarizeSplits", () => {
  it("counts splits by state and immature published splits, and finds the last publish", () => {
    const summary = summarizeSplits([
      { split_state: "Published", publish_timestamp: at("2026-11-14T10:00:00Z"), maturity: { type: "immature" } },
      { split_state: "Published", publish_timestamp: at("2026-11-14T11:00:00Z"), maturity: { type: "mature" } },
      { split_state: "Staged" },
      { split_state: "MarkedForDeletion", publish_timestamp: at("2026-11-14T11:59:00Z") },
    ]);
    expect(summary).toEqual({
      published: 2,
      staged: 1,
      markedForDeletion: 1,
      immature: 1,
      lastPublishedAt: "2026-11-14T11:59:00.000Z",
      truncated: false,
    });
  });

  it("says when the list hit the limit so the counts are a floor", () => {
    expect(summarizeSplits([{ split_state: "Published" }, { split_state: "Published" }], 2).truncated).toBe(true);
  });
});

describe("indexStatus", () => {
  it("is healthy for recent events, stale for old ones, empty with no documents", () => {
    expect(indexStatus(10, "2026-11-14T11:30:00.000Z", 60, now)).toBe("healthy");
    expect(indexStatus(10, "2026-11-14T10:00:00.000Z", 60, now)).toBe("stale");
    expect(indexStatus(0, null, 60, now)).toBe("empty");
    expect(indexStatus(5, null, 60, now)).toBe("empty");
  });
});

describe("toIndexHealth", () => {
  it("maps the quickwit description to size, documents and the newest and oldest event", () => {
    const health = toIndexHealth(description(), [], 60, now);
    expect(health).toMatchObject({
      indexId: "telemetry-logs",
      status: "healthy",
      documents: 120,
      sizeBytes: 5000,
      uncompressedBytes: 20000,
      oldestEventAt: "2026-11-10T00:00:00.000Z",
      newestEventAt: "2026-11-14T11:30:00.000Z",
    });
  });

  it("treats a missing timestamp range as no events", () => {
    const health = toIndexHealth(description({ num_published_docs: 0, min_timestamp: null, max_timestamp: null }), [], 60, now);
    expect(health.status).toBe("empty");
    expect(health.newestEventAt).toBeNull();
  });
});

describe("IndexHealthService", () => {
  it("reports an unreachable index without failing the others", async () => {
    const quickwit = {
      describeIndex: vi.fn().mockImplementation(async (id: string) => {
        if (id === "telemetry-traces") throw new Error("Quickwit request failed (404): index not found");
        return description({ index_id: id });
      }),
      listSplits: vi.fn().mockResolvedValue([]),
    };
    const snapshot = await new IndexHealthService(quickwit as never).snapshot();
    const traces = snapshot.indexes.find((index) => index.indexId === "telemetry-traces")!;
    expect(traces.status).toBe("unavailable");
    expect(traces.error).toContain("index not found");
    expect(snapshot.indexes.filter((index) => index.status !== "unavailable").length).toBe(snapshot.indexes.length - 1);
    expect(snapshot.staleAfterMinutes).toBe(60);
  });

  it("clips long errors", () => {
    expect(unavailableIndex("x", new Error("e".repeat(500))).error!.length).toBe(200);
  });
});
