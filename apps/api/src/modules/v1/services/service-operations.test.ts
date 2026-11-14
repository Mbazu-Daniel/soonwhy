import { describe, expect, it, vi } from "vitest";
import { buildDependencies, buildOperations, failingOperations } from "./service-operations";
import { ServiceOperationsService } from "./service-operations.service";

const latency = { values: { "50.0": 10, "95.0": 120.456, "99.0": 200 } };

describe("buildOperations", () => {
  it("combines counts, error counts and latency per operation", () => {
    const result = buildOperations(
      { buckets: [{ key: "GET /a", doc_count: 8, avg: { value: 33.333 }, latency }, { key: "POST /b", doc_count: 20, avg: { value: 5 }, latency }] },
      { buckets: [{ key: "GET /a", doc_count: 2 }] },
    );
    expect(result.map((item) => item.name)).toEqual(["POST /b", "GET /a"]);
    expect(result[1]).toEqual({ name: "GET /a", requests: 8, errors: 2, errorRate: 25, avgMs: 33.33, p50Ms: 10, p95Ms: 120.46, p99Ms: 200 });
    expect(result[0]!.errors).toBe(0);
  });

  it("never reports more errors than requests and skips empty names", () => {
    const result = buildOperations({ buckets: [{ key: "x", doc_count: 1 }, { key: "", doc_count: 5 }] }, { buckets: [{ key: "x", doc_count: 9 }] });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ errors: 1, errorRate: 100, p95Ms: 0 });
  });

  it("returns nothing for missing aggregations", () => {
    expect(buildOperations(undefined, undefined)).toEqual([]);
  });
});

describe("buildDependencies", () => {
  it("carries the dependency type", () => {
    const result = buildDependencies({ buckets: [{ key: "postgres", doc_count: 4, type: { buckets: [{ key: "database" }] } }, { key: "other", doc_count: 1 }] }, undefined);
    expect(result.map((item) => [item.name, item.type])).toEqual([["postgres", "database"], ["other", "unknown"]]);
  });
});

describe("failingOperations", () => {
  it("lists only operations with errors, worst first", () => {
    const base = { requests: 10, avgMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0 };
    const result = failingOperations([
      { ...base, name: "a", errors: 0, errorRate: 0 },
      { ...base, name: "b", errors: 2, errorRate: 20 },
      { ...base, name: "c", errors: 5, errorRate: 50 },
    ]);
    expect(result.map((item) => item.name)).toEqual(["c", "b"]);
  });
});

describe("ServiceOperationsService", () => {
  it("scopes both queries to the service and span kinds", async () => {
    const search = vi.fn().mockResolvedValue({ aggregations: { groups: { buckets: [] } } });
    const service = new ServiceOperationsService({ search, range: () => ({ from: "2026-01-01T00:00:00.000Z", to: "2026-01-02T00:00:00.000Z" }) } as never);
    const result = await service.forService({ orgId: "o", projectId: "p", service: "api" });
    expect(result).toEqual({ service: "api", operations: [], dependencies: [], failing: [] });
    expect(search).toHaveBeenCalledTimes(4);
    const filters = search.mock.calls.map((call) => (call[1] as { filters: string[] }).filters.join(" | "));
    expect(filters.every((filter) => filter.includes('service:"api"'))).toBe(true);
    expect(filters.some((filter) => filter.includes("spanKind:2") && filter.includes("statusCode:2"))).toBe(true);
    expect(filters.some((filter) => filter.includes("spanKind:3") && filter.includes("spanKind:4"))).toBe(true);
  });
});
