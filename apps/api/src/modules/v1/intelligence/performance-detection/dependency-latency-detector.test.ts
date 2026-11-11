import { describe, expect, it } from "vitest";
import {
  detectDependencyLatency,
  detectInternalServiceLatency,
} from "./dependency-latency-detector";
import type { PerformanceBaseline } from "./performance-detection.types";

function baseline(value: number, samples = 30): PerformanceBaseline {
  return { value, samples, period: "1h", calculatedAt: "2026-05-01T00:00:00.000Z" };
}

describe("detectDependencyLatency", () => {
  it("returns a candidate without a comparable baseline", () => {
    const finding = detectDependencyLatency(50, undefined, "http", "payments", "POST /charge");

    expect(finding).toMatchObject({ severity: "candidate", resourceName: "payments" });
  });

  it("flags a warning when the dependency slows down materially", () => {
    const finding = detectDependencyLatency(
      700,
      baseline(400),
      "redis",
      "cache",
      "get",
      "checkout",
    );

    expect(finding).toMatchObject({ severity: "warning", changePercent: 75 });
    expect(finding?.identity.domain).toBe("dependency");
  });

  it("escalates to critical when latency doubles", () => {
    const finding = detectDependencyLatency(1600, baseline(500), "grpc", "inventory");

    expect(finding?.severity).toBe("critical");
  });

  it("ignores regressions below the absolute threshold", () => {
    expect(detectDependencyLatency(340, baseline(100), "http", "payments")).toBeUndefined();
  });

  it("applies the same rules to internal services", () => {
    const finding = detectInternalServiceLatency(1200, baseline(400), "inventory", "reserve", "checkout");

    expect(finding).toMatchObject({ severity: "critical", serviceName: "checkout" });
  });
});
