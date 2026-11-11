import { describe, expect, it } from "vitest";
import {
  detectContainerResourcePressure,
  detectCpuSaturation,
  detectDiskIoPressure,
  detectEventLoopLag,
  detectHostResourcePressure,
  detectMemoryPressure,
  detectNetworkIoPressure,
} from "./resource-saturation-detector";

describe("detectCpuSaturation", () => {
  it("stays quiet below the warning threshold", () => {
    expect(detectCpuSaturation(69.9)).toBeUndefined();
  });

  it("warns at seventy percent and escalates at ninety", () => {
    expect(detectCpuSaturation(70, "host-1")).toMatchObject({
      severity: "warning",
      metric: "cpu",
      observedValue: 70,
      hostId: "host-1",
    });
    expect(detectCpuSaturation(90)?.severity).toBe("critical");
  });
});

describe("detectMemoryPressure", () => {
  it("warns and escalates on memory utilization", () => {
    expect(detectMemoryPressure(75)?.severity).toBe("warning");
    expect(detectMemoryPressure(95)?.severity).toBe("critical");
    expect(detectMemoryPressure(50)).toBeUndefined();
  });
});

describe("detectEventLoopLag", () => {
  it("flags lag above fifty milliseconds", () => {
    expect(detectEventLoopLag(50)).toMatchObject({ severity: "warning", metric: "event_loop" });
    expect(detectEventLoopLag(120)?.severity).toBe("critical");
    expect(detectEventLoopLag(10)).toBeUndefined();
  });
});

describe("detectDiskIoPressure", () => {
  it("prefers wait time over utilization when supplied", () => {
    expect(detectDiskIoPressure(10, 120)).toMatchObject({
      metric: "disk_io",
      observedValue: 120,
      unit: "ms",
      severity: "warning",
    });
    expect(detectDiskIoPressure(200)?.unit).toBe("%");
  });

  it("ignores pressure below the threshold", () => {
    expect(detectDiskIoPressure(50, 20)).toBeUndefined();
  });
});

describe("detectNetworkIoPressure", () => {
  it("flags elevated network latency", () => {
    expect(detectNetworkIoPressure(10, 160)).toMatchObject({
      metric: "network_io",
      unit: "ms",
      severity: "critical",
    });
  });

  it("ignores healthy utilization", () => {
    expect(detectNetworkIoPressure(40)).toBeUndefined();
  });
});

describe("detectContainerResourcePressure", () => {
  it("prioritizes OOM kills over other signals", () => {
    const finding = detectContainerResourcePressure(
      { cpuUsagePercent: 95, memoryUsagePercent: 99, oomKilled: true },
      "container-1",
      "host-1",
    );

    expect(finding).toMatchObject({ severity: "critical", metric: "memory", containerId: "container-1" });
  });

  it("flags CPU throttling as a warning", () => {
    const finding = detectContainerResourcePressure(
      { cpuUsagePercent: 40, memoryUsagePercent: 40, cpuThrottled: true },
      "container-1",
    );

    expect(finding).toMatchObject({ severity: "warning", metric: "cpu" });
  });

  it("flags combined CPU and memory pressure as critical", () => {
    const finding = detectContainerResourcePressure(
      { cpuUsagePercent: 80, memoryUsagePercent: 85 },
      "container-1",
    );

    expect(finding).toMatchObject({ severity: "critical", metric: "cpu" });
  });

  it("returns nothing for healthy containers", () => {
    expect(
      detectContainerResourcePressure({ cpuUsagePercent: 20, memoryUsagePercent: 30 }, "container-1"),
    ).toBeUndefined();
  });
});

describe("detectHostResourcePressure", () => {
  it("reports a warning for a single saturated resource", () => {
    const finding = detectHostResourcePressure(
      { cpuUsagePercent: 95, memoryUsagePercent: 20, diskUtilizationPercent: 10, networkUtilizationPercent: 10 },
      "host-1",
    );

    expect(finding).toMatchObject({ severity: "warning", hostId: "host-1" });
    expect(finding?.reason).toContain("CPU");
  });

  it("escalates when multiple resources are saturated", () => {
    const finding = detectHostResourcePressure(
      { cpuUsagePercent: 95, memoryUsagePercent: 92, diskUtilizationPercent: 10, networkUtilizationPercent: 10 },
      "host-1",
    );

    expect(finding?.severity).toBe("critical");
  });

  it("returns nothing for a healthy host", () => {
    expect(
      detectHostResourcePressure(
        { cpuUsagePercent: 20, memoryUsagePercent: 30, diskUtilizationPercent: 10, networkUtilizationPercent: 10 },
        "host-1",
      ),
    ).toBeUndefined();
  });
});
