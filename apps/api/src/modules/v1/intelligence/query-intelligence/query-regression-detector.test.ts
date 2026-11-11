import { describe, expect, it } from "vitest";
import { detectQueryRegression } from "./query-regression-detector";
import type { QueryAggregation } from "./query-intelligence.types";

function aggregation(overrides: Partial<QueryAggregation> = {}): QueryAggregation {
  return {
    queryIdentity: {
      fingerprint: "fp-1",
      fingerprintVersion: 1,
      operation: "select",
      normalizedQuery: "select * from orders where id = ?",
    },
    executionCount: 10,
    totalDurationMs: 1000,
    avgDurationMs: 100,
    p50DurationMs: 80,
    p95DurationMs: 150,
    p99DurationMs: 200,
    errorCount: 0,
    errorRate: 0,
    totalRowsAffected: 10,
    firstSeenAt: "2026-05-01T00:00:00.000Z",
    lastSeenAt: "2026-05-01T01:00:00.000Z",
    ...overrides,
  };
}

describe("detectQueryRegression", () => {
  it("returns nothing for stable queries", () => {
    expect(detectQueryRegression(aggregation(), aggregation())).toBeUndefined();
  });

  it("flags a warning for a fifty percent latency increase", () => {
    const finding = detectQueryRegression(
      aggregation({ avgDurationMs: 160 }),
      aggregation({ avgDurationMs: 100 }),
    );

    expect(finding).toMatchObject({
      severity: "warning",
      latencyChangePercent: 60,
      queryIdentity: { fingerprint: "fp-1" },
    });
  });

  it("escalates to critical when latency doubles", () => {
    const finding = detectQueryRegression(
      aggregation({ avgDurationMs: 200 }),
      aggregation({ avgDurationMs: 100 }),
    );

    expect(finding?.severity).toBe("critical");
  });

  it("flags an error rate jump beyond the configured threshold", () => {
    const finding = detectQueryRegression(
      aggregation({ errorRate: 0.2 }),
      aggregation({ errorRate: 0.1 }),
      0.5,
      0.05,
    );

    expect(finding?.errorRateChangePercent).toBeCloseTo(10);
    expect(finding?.severity).toBe("warning");
  });

  it("escalates when query frequency multiplies", () => {
    const finding = detectQueryRegression(
      aggregation({ executionCount: 50 }),
      aggregation({ executionCount: 10 }),
    );

    expect(finding?.frequencyChangePercent).toBe(400);
    expect(finding?.severity).toBe("critical");
  });
});
