import { describe, expect, it, vi } from "vitest";
import { MetricsRepository } from "../metrics/metrics.repository";
import { MetricsService } from "../metrics/metrics.service";
import { DashboardService } from "./dashboard.service";

const aggregations = {
  latency: { values: { "50.0": 4.4, "95.0": 342.2, "99.0": 2145.7 } },
  average: { value: 120.6 },
  status: {
    buckets: [
      { key: "2xx", doc_count: 37 },
      { key: "3xx", doc_count: 0 },
      { key: "4xx", doc_count: 251 },
      { key: "5xx", doc_count: 6 },
    ],
  },
};

function build() {
  const search = vi.fn().mockImplementation(async (_index: string, request: { aggregations: Record<string, unknown> }) => {
    if ("services" in request.aggregations) {
      return {
        num_hits: 294,
        hits: [],
        aggregations: {
          services: {
            buckets: [
              { key: "api", doc_count: 294, latency: { values: { "95.0": 342.2 } }, status: aggregations.status },
            ],
          },
        },
      };
    }
    if ("over_time" in request.aggregations) {
      return {
        num_hits: 294,
        hits: [],
        aggregations: {
          over_time: {
            buckets: [
              { key_as_string: "2026-11-14T10:00:00Z", doc_count: 100, latency: { values: {} }, status: { buckets: [] } },
              { key_as_string: "2026-11-14T11:00:00Z", doc_count: 194, latency: { values: {} }, status: { buckets: [] } },
            ],
          },
        },
      };
    }
    return { num_hits: 294, hits: [], aggregations };
  });
  const repository = new MetricsRepository({ search } as never);
  const cache = { getOrSet: (_key: string, _ttl: number, load: () => Promise<unknown>) => load() };
  return {
    dashboard: new DashboardService({ search } as never, cache as never, repository),
    metrics: new MetricsService(repository),
  };
}

describe("overview and metrics agree", () => {
  const from = "2026-11-14T00:00:00.000Z";
  const to = "2026-11-15T00:00:00.000Z";

  it("report identical totals, error rate and latency with no filter", async () => {
    const { dashboard, metrics } = build();
    const overview = await dashboard.getOverview("org", "project", from, to);
    const summary = await metrics.getSummary("org", { projectId: "project", from, to });
    expect(overview).toMatchObject({
      totalRequests: summary.totalRequests,
      errorRate: summary.errorRate,
      errorCount: summary.errorCount,
      avgLatency: summary.avgLatency,
      latencyP50: summary.latencyP50,
      latencyP95: summary.latencyP95,
      latencyP99: summary.latencyP99,
    });
    expect(overview.totalRequests).toBe(294);
    expect(overview.errorRate).toBe(87.41);
    expect(overview.avgLatency).toBe(121);
  });

  it("builds the time series from the same requests", async () => {
    const { dashboard } = build();
    const overview = await dashboard.getOverview("org", "project", from, to);
    expect(overview.timeSeries.reduce((sum, point) => sum + point.count, 0)).toBe(294);
    expect(overview.timeSeries.map((point) => Math.round(point.normalizedHeight))).toEqual([52, 100]);
  });

  it("gives per-service numbers that add up to the overview", async () => {
    const { dashboard } = build();
    const services = await dashboard.getServices("org", "project", from, to);
    expect(services).toEqual([
      { service: "api", requestCount: 294, errorCount: 257, errorRate: 87.41, p95Latency: 342 },
    ]);
  });

  it("applies a service filter to the summary query only", async () => {
    const { metrics } = build();
    await metrics.getSummary("org", { projectId: "project", from, to, service: "api" });
    const search = (metrics as unknown as { metricsRepository: { quickwit: { search: ReturnType<typeof vi.fn> } } }).metricsRepository.quickwit.search;
    expect(search.mock.calls.at(-1)![1].query).toContain('service:"api"');
  });
});
