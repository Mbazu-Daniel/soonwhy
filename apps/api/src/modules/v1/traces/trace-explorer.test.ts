import { describe, expect, it, vi } from "vitest";
import { bucketInterval, clampBucketStart } from "../../../common/telemetry/bucket-interval";
import { decodeOffset, nextOffsetCursor } from "./trace-cursor";
import { traceFilters, traceIdList } from "./trace-filters";
import { buildTraceList } from "./trace-list";
import { TracesRepository } from "./traces.repository";

describe("traceFilters", () => {
  it("always limits to entry spans and adds each filter", () => {
    const filters = traceFilters({ service: "web", operation: "GET /a", minDuration: 100, maxDuration: 900, q: "abc" });
    expect(filters[0]).toContain("spanKind:2");
    expect(filters).toContain('service:"web"');
    expect(filters).toContain('name:"GET \\/a"');
    expect(filters).toContain("duration:>=100");
    expect(filters).toContain("duration:<=900");
    expect(filters.some((filter) => filter.includes('traceId:"abc"') && filter.includes('name:"abc"'))).toBe(true);
  });

  it("keeps zero as a real duration bound", () => {
    expect(traceFilters({ minDuration: 0 })).toContain("duration:>=0");
  });

  it("escapes trace ids in a list", () => {
    expect(traceIdList(["a", 'b"c'])).toBe('traceId:("a" OR "b\\"c")');
  });
});

describe("buildTraceList", () => {
  const span = (traceId: string, extra = {}) => ({ traceId, name: "GET /", service: "web", timestamp: "2026-11-14T10:00:00.000Z", duration: 120, ...extra });

  it("fills counts and marks traces with any error span", () => {
    const rows = buildTraceList(
      [span("t1"), span("t2")],
      { buckets: [{ key: "t1", doc_count: 4 }, { key: "t2", doc_count: 1 }] },
      { buckets: [{ key: "t1", doc_count: 1 }] },
    );
    expect(rows.map((row) => [row.traceId, row.spanCount, row.errorCount, row.status])).toEqual([["t1", 4, 1, "error"], ["t2", 1, 0, "ok"]]);
    expect(rows[0]).toMatchObject({ rootOperation: "GET /", rootService: "web", durationMs: 120, end: "2026-11-14T10:00:00.120Z" });
  });

  it("shows a trace once even when it has several entry spans", () => {
    expect(buildTraceList([span("t1"), span("t1")], undefined, undefined)).toHaveLength(1);
  });

  it("marks the trace failed when its own entry span failed", () => {
    expect(buildTraceList([span("t1", { statusCode: 2 })], undefined, undefined)[0]!.status).toBe("error");
  });
});

describe("offset cursor and interval", () => {
  it("limits chart ranges to 90 days", () => {
    expect(clampBucketStart("1970-01-01T00:00:00.000Z", "2026-11-14T00:00:00.000Z")).toBe("2026-08-16T00:00:00.000Z");
  });

  it("pages by offset and stops at a short page", () => {
    expect(decodeOffset(nextOffsetCursor(0, 20, 20))).toBe(20);
    expect(nextOffsetCursor(0, 5, 20)).toBeUndefined();
    expect(decodeOffset("bad")).toBe(0);
  });

  it("scales the chart bucket with the range", () => {
    expect(bucketInterval("2026-11-14T00:00:00Z", "2026-11-14T01:00:00Z")).toBe("60s");
    expect(bucketInterval("2026-11-14T00:00:00Z", "2026-11-15T00:00:00Z")).toBe("1800s");
  });
});

describe("TracesRepository", () => {
  const scope = { orgId: "o", projectId: "p", from: "2026-11-14T00:00:00.000Z", to: "2026-11-15T00:00:00.000Z" };

  it("returns nothing for status=error when no trace has an error span", async () => {
    const search = vi.fn().mockResolvedValue({ hits: [], aggregations: { ids: { buckets: [] } } });
    const repository = new TracesRepository({ search } as never);
    expect(await repository.listTraces({ ...scope, status: "error", limit: 20, offset: 0 })).toEqual([]);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("excludes error traces for status=ok", async () => {
    const search = vi.fn()
      .mockResolvedValueOnce({ hits: [], aggregations: { ids: { buckets: [{ key: "bad", doc_count: 1 }] } } })
      .mockResolvedValueOnce({ hits: [] });
    const repository = new TracesRepository({ search } as never);
    await repository.listTraces({ ...scope, status: "ok", limit: 20, offset: 0 });
    const filters = (search.mock.calls[1]![1] as { filters: string[] }).filters;
    expect(filters).toContain('NOT traceId:("bad")');
  });

  it("counts logs per span and ignores logs without a span", async () => {
    const search = vi.fn().mockResolvedValue({ aggregations: { spans: { buckets: [{ key: "s1", doc_count: 3 }, { key: "", doc_count: 9 }] } } });
    const repository = new TracesRepository({ search } as never);
    expect(await repository.spanLogCounts({ orgId: "o", projectId: "p", traceId: "t" })).toEqual({ s1: 3 });
  });
});

describe("trace id filter", () => {
  it("restricts entry spans to the given traces", () => {
    expect(traceFilters({ traceIds: ["a", "b"] })).toContain('traceId:("a" OR "b")');
    expect(traceFilters({ traceIds: [] }).some((filter) => filter.startsWith("traceId:"))).toBe(false);
  });

  it("parses a comma separated list and rejects odd ids or too many", async () => {
    const { getTracesSchema } = await import("./dto");
    const base = { projectId: "p" };
    expect(getTracesSchema.parse({ ...base, traceIds: "a, b ,c" }).traceIds).toEqual(["a", "b", "c"]);
    expect(getTracesSchema.safeParse({ ...base, traceIds: 'a" OR org_id:x' }).success).toBe(false);
    expect(getTracesSchema.safeParse({ ...base, traceIds: Array.from({ length: 101 }, (_, i) => `t${i}`).join(",") }).success).toBe(false);
  });
});
