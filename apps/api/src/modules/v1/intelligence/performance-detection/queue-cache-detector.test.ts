import { describe, expect, it } from "vitest";
import {
  detectCacheLatency,
  detectQueueLatency,
} from "./queue-cache-detector";
import type { PerformanceBaseline } from "./performance-detection.types";

function baseline(value: number, samples = 30): PerformanceBaseline {
  return { value, samples, period: "1h", calculatedAt: "2026-05-01T00:00:00.000Z" };
}

describe("detectQueueLatency", () => {
  it("returns a candidate without a baseline", () => {
    expect(detectQueueLatency(40, undefined, "orders", "kafka")).toMatchObject({
      severity: "candidate",
      resourceName: "orders",
    });
  });

  it("flags material queue latency growth", () => {
    const finding = detectQueueLatency(700, baseline(400), "orders", "kafka", "checkout");

    expect(finding).toMatchObject({ severity: "warning", changePercent: 75 });
    expect(finding?.identity.domain).toBe("dependency");
  });

  it("escalates to critical when queue latency doubles", () => {
    expect(detectQueueLatency(1200, baseline(500), "orders", "bullmq")?.severity).toBe("critical");
  });

  it("ignores small regressions and invalid observations", () => {
    expect(detectQueueLatency(300, baseline(100), "orders", "kafka")).toBeUndefined();
    expect(detectQueueLatency(0, baseline(100), "orders", "kafka")).toBeUndefined();
  });
});

describe("detectCacheLatency", () => {
  it("uses stricter cache thresholds than queue latency", () => {
    expect(detectCacheLatency(30, baseline(10), "session", "redis")).toMatchObject({
      severity: "critical",
      changePercent: 200,
    });
  });

  it("flags a warning for a hundred percent increase", () => {
    expect(detectCacheLatency(40, baseline(20), "session", "redis", "get")?.severity).toBe("warning");
  });

  it("ignores increases below ten milliseconds or under a hundred percent", () => {
    expect(detectCacheLatency(15, baseline(10), "session", "redis")).toBeUndefined();
    expect(detectCacheLatency(19, baseline(10), "session", "memory")).toBeUndefined();
  });

  it("returns a candidate without a baseline", () => {
    expect(detectCacheLatency(5, undefined, "session", "redis")).toMatchObject({ severity: "candidate" });
  });
});
