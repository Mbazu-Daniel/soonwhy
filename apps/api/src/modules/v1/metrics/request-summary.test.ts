import { describe, expect, it } from "vitest";
import {
  errorRateOf,
  healthScore,
  percentileOf,
  statusCountsOf,
  summarize,
  summaryInterval,
} from "./request-summary";

describe("request summary", () => {
  it("counts 4xx and 5xx as errors and rounds the rate", () => {
    const summary = summarize({
      total: 294,
      average: 120.4,
      p50: 1.2,
      p95: 341.6,
      p99: 2145.1,
      status: { _2xx: 37, _3xx: 0, _4xx: 251, _5xx: 6 },
    });
    expect(summary).toMatchObject({
      totalRequests: 294,
      errorCount: 257,
      errorRate: 87.41,
      avgLatency: 120,
      latencyP50: 1,
      latencyP95: 342,
      latencyP99: 2145,
    });
  });

  it("has a zero error rate with no requests", () => {
    expect(errorRateOf(0, 0)).toBe(0);
  });

  it("reads status buckets and percentiles from an aggregation", () => {
    const aggregation = {
      latency: { values: { "50.0": 10, "95.0": 90, "99.0": 200 } },
      status: { buckets: [{ key: "2xx", doc_count: 5 }, { key: "5xx", doc_count: 1 }] },
    };
    expect(statusCountsOf(aggregation)).toEqual({ _2xx: 5, _3xx: 0, _4xx: 0, _5xx: 1 });
    expect(percentileOf(aggregation, 95)).toBe(90);
    expect(percentileOf({}, 95)).toBe(0);
  });

  it("scores health from errors and latency, and zero without traffic", () => {
    const base = { errorCount: 0, errorRate: 0, avgLatency: 0, latencyP50: 0, latencyP99: 0, statusCodes: { _2xx: 0, _3xx: 0, _4xx: 0, _5xx: 0 } };
    expect(healthScore({ ...base, totalRequests: 0, latencyP95: 0 })).toBe(0);
    expect(healthScore({ ...base, totalRequests: 10, latencyP95: 200 })).toBe(98);
    expect(healthScore({ ...base, totalRequests: 10, errorRate: 50, latencyP95: 0 })).toBe(0);
  });

  it("picks a bucket size from the range", () => {
    expect(summaryInterval(3_600_000)).toBe("5m");
    expect(summaryInterval(24 * 3_600_000)).toBe("1h");
    expect(summaryInterval(30 * 24 * 3_600_000)).toBe("1d");
  });
});
