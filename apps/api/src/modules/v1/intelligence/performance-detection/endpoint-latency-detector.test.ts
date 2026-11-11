import { describe, expect, it } from "vitest";
import { detectEndpointLatencyRegression } from "./endpoint-latency-detector";
import type { PerformanceBaseline } from "./performance-detection.types";

function baseline(value: number, samples = 30): PerformanceBaseline {
  return { value, samples, period: "1h", calculatedAt: "2026-05-01T00:00:00.000Z" };
}

describe("detectEndpointLatencyRegression", () => {
  it("returns a candidate when no sampled baseline exists", () => {
    const finding = detectEndpointLatencyRegression(400, undefined, "GET", "/orders");

    expect(finding).toMatchObject({ severity: "candidate", observedValue: 400, unit: "ms" });
    expect(finding?.evidence.samples).toBe(0);
  });

  it("flags a warning when latency rises above the relative and absolute thresholds", () => {
    const finding = detectEndpointLatencyRegression(700, baseline(400), "GET", "/orders", "checkout");

    expect(finding).toMatchObject({
      severity: "warning",
      observedValue: 700,
      baselineValue: 400,
      changePercent: 75,
      serviceName: "checkout",
    });
  });

  it("escalates to critical at a hundred percent increase", () => {
    const finding = detectEndpointLatencyRegression(800, baseline(400), "GET", "/orders");

    expect(finding?.severity).toBe("critical");
  });

  it("ignores small absolute or relative increases", () => {
    expect(detectEndpointLatencyRegression(200, baseline(100), "GET", "/orders")).toBeUndefined();
    expect(detectEndpointLatencyRegression(300, baseline(290), "GET", "/orders")).toBeUndefined();
  });

  it("rejects invalid observations and under-sampled baselines", () => {
    expect(detectEndpointLatencyRegression(0, baseline(100), "GET", "/orders")).toBeUndefined();
    expect(detectEndpointLatencyRegression(Number.NaN, baseline(100), "GET", "/orders")).toBeUndefined();
    expect(
      detectEndpointLatencyRegression(1000, baseline(100, 5), "GET", "/orders"),
    ).toMatchObject({ severity: "candidate" });
  });
});
