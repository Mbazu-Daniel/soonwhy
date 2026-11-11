import { describe, expect, it } from "vitest";
import {
  detectConnectionPoolSaturation,
  detectGcPressure,
  detectLockWaitTime,
} from "./lock-connection-detector";

describe("detectLockWaitTime", () => {
  it("ignores short waits", () => {
    expect(detectLockWaitTime(99, "database_lock")).toBeUndefined();
  });

  it("warns for waits over a hundred milliseconds", () => {
    expect(detectLockWaitTime(150, "mutex", "cache-init", "checkout")).toMatchObject({
      severity: "warning",
      observedValue: 150,
      serviceName: "checkout",
      resourceName: "cache-init",
    });
  });

  it("escalates at one second", () => {
    expect(detectLockWaitTime(1000, "file_lock")?.severity).toBe("critical");
  });
});

describe("detectConnectionPoolSaturation", () => {
  it("stays quiet below seventy percent utilization", () => {
    expect(
      detectConnectionPoolSaturation(
        { activeConnections: 69, totalConnections: 100, maxConnections: 100 },
        "database",
        "primary",
      ),
    ).toBeUndefined();
  });

  it("warns with waiting requests and escalates at ninety percent", () => {
    const warning = detectConnectionPoolSaturation(
      { activeConnections: 75, totalConnections: 100, maxConnections: 100, waitingCount: 3 },
      "http",
      "upstream",
    );
    const critical = detectConnectionPoolSaturation(
      { activeConnections: 95, totalConnections: 100, maxConnections: 100 },
      "redis",
      "cache",
    );

    expect(warning).toMatchObject({ severity: "warning", observedValue: 75, metric: "connection_pool" });
    expect(warning?.reason).toContain("3 requests waiting");
    expect(critical?.severity).toBe("critical");
  });
});

describe("detectGcPressure", () => {
  const healthy = { pauseTimeMs: 10, frequency: 1, heapSizeMB: 100, heapLimitMB: 1000 };

  it("flags long pauses as critical", () => {
    expect(detectGcPressure({ ...healthy, pauseTimeMs: 120 })?.severity).toBe("critical");
  });

  it("flags high pause frequency as a warning", () => {
    expect(detectGcPressure({ ...healthy, frequency: 12 })).toMatchObject({
      severity: "warning",
      unit: "pauses/sec",
    });
  });

  it("flags high heap utilization", () => {
    expect(detectGcPressure({ ...healthy, heapSizeMB: 850 })).toMatchObject({
      metric: "memory",
      severity: "warning",
    });
    expect(detectGcPressure({ ...healthy, heapSizeMB: 950 })?.severity).toBe("critical");
  });

  it("returns nothing for healthy GC metrics", () => {
    expect(detectGcPressure(healthy)).toBeUndefined();
  });
});
