import { describe, expect, it } from "vitest";
import {
  detectCpuSpike,
  detectEventLoopLag,
  detectGcPressure,
  detectMemoryPressure,
  detectResourceExhaustion,
} from "./runtime-metrics-detector";
import type { RuntimeMetrics } from "./runtime-intelligence.types";

function metrics(overrides: Partial<RuntimeMetrics> = {}): RuntimeMetrics {
  return {
    cpuUsagePercent: 20,
    heapUsedMB: 100,
    heapTotalMB: 200,
    heapLimitMB: 1000,
    externalMB: 10,
    arrayBuffersMB: 5,
    eventLoopLagMs: 5,
    activeHandles: 10,
    activeRequests: 10,
    gcPauseTimeMs: 5,
    gcFrequency: 1,
    timestamp: "2026-05-01T00:00:00.000Z",
    serviceName: "checkout",
    ...overrides,
  };
}

describe("detectCpuSpike", () => {
  it("warns at seventy percent and escalates at ninety", () => {
    expect(detectCpuSpike(metrics({ cpuUsagePercent: 70 }))).toMatchObject({
      metric: "cpu",
      severity: "warning",
      detectedAt: "2026-05-01T00:00:00.000Z",
    });
    expect(detectCpuSpike(metrics({ cpuUsagePercent: 90 }))?.severity).toBe("critical");
  });

  it("ignores normal utilization", () => {
    expect(detectCpuSpike(metrics())).toBeUndefined();
  });
});

describe("detectMemoryPressure", () => {
  it("uses heap utilization for severity", () => {
    expect(detectMemoryPressure(metrics({ heapUsedMB: 750 }))).toMatchObject({
      metric: "memory",
      observedValue: 75,
      severity: "warning",
    });
    expect(detectMemoryPressure(metrics({ heapUsedMB: 950 }))?.severity).toBe("critical");
  });

  it("ignores low heap utilization", () => {
    expect(detectMemoryPressure(metrics())).toBeUndefined();
  });
});

describe("detectEventLoopLag", () => {
  it("flags lag above the warning threshold", () => {
    expect(detectEventLoopLag(metrics({ eventLoopLagMs: 50 }))?.severity).toBe("warning");
    expect(detectEventLoopLag(metrics({ eventLoopLagMs: 120 }))?.severity).toBe("critical");
  });

  it("ignores responsive event loops", () => {
    expect(detectEventLoopLag(metrics())).toBeUndefined();
  });
});

describe("detectGcPressure", () => {
  it("prioritizes long pauses over frequency", () => {
    expect(
      detectGcPressure(metrics({ gcPauseTimeMs: 120, gcFrequency: 20 })),
    ).toMatchObject({ metric: "gc", unit: "ms", severity: "critical" });
  });

  it("flags high frequency as a warning", () => {
    expect(detectGcPressure(metrics({ gcFrequency: 12 }))).toMatchObject({
      unit: "pauses/sec",
      severity: "warning",
    });
  });

  it("ignores healthy GC metrics", () => {
    expect(detectGcPressure(metrics())).toBeUndefined();
  });
});

describe("detectResourceExhaustion", () => {
  it("flags high handle counts", () => {
    expect(detectResourceExhaustion(metrics({ activeHandles: 1200 }))).toMatchObject({
      metric: "handles",
      observedValue: 1200,
    });
  });

  it("returns the first finding when handles are healthy but requests are high", () => {
    expect(detectResourceExhaustion(metrics({ activeRequests: 1500 }))).toMatchObject({
      metric: "requests",
      observedValue: 1500,
    });
  });

  it("returns nothing for healthy concurrency", () => {
    expect(detectResourceExhaustion(metrics())).toBeUndefined();
  });
});
