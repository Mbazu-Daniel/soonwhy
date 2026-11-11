import { describe, expect, it } from "vitest";
import { detectDatabaseLatency } from "./database-latency-detector";
import type { PerformanceBaseline } from "./performance-detection.types";

function baseline(value: number, samples = 30): PerformanceBaseline {
  return { value, samples, period: "1h", calculatedAt: "2026-05-01T00:00:00.000Z" };
}

describe("detectDatabaseLatency", () => {
  it("returns a candidate without a sufficiently sampled baseline", () => {
    const finding = detectDatabaseLatency(120, undefined, "select * from orders where id = ?");

    expect(finding).toMatchObject({ severity: "candidate", unit: "ms" });
  });

  it("flags a warning when query latency rises", () => {
    const finding = detectDatabaseLatency(
      700,
      baseline(400),
      "select * from orders where id = ?",
      "postgres",
      "checkout",
    );

    expect(finding).toMatchObject({
      severity: "warning",
      observedValue: 700,
      baselineValue: 400,
      serviceName: "checkout",
    });
    expect(finding?.identity.domain).toBe("database");
  });

  it("escalates to critical when latency doubles", () => {
    const finding = detectDatabaseLatency(1200, baseline(500), "select 1");

    expect(finding?.severity).toBe("critical");
  });

  it("ignores latency that does not clear both thresholds", () => {
    expect(detectDatabaseLatency(400, baseline(300), "select 1")).toBeUndefined();
    expect(detectDatabaseLatency(900, baseline(800), "select 1")).toBeUndefined();
  });

  it("rejects non-positive observations", () => {
    expect(detectDatabaseLatency(0, baseline(100), "select 1")).toBeUndefined();
    expect(detectDatabaseLatency(-5, baseline(100), "select 1")).toBeUndefined();
  });
});
