import { describe, expect, it } from "vitest";
import { averagePercent, formatBytes, formatRate, hostPoints, networkTotals } from "./host-metrics-view";

const bucket = (over: object = {}) => ({
  bucket: "2026-11-16T10:00:00.000Z",
  cpu_percent: 10,
  memory_percent: 20,
  disk_percent: 30,
  network_in_bytes: 6000,
  network_out_bytes: 1200,
  ...over,
});

describe("formatBytes", () => {
  it("scales through the units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(250 * 1024 ** 3)).toBe("250 GB");
  });

  it("treats negative and non-finite values as zero", () => {
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });

  it("formats a rate per second", () => {
    expect(formatRate(2048)).toBe("2.0 KB/s");
  });
});

describe("hostPoints", () => {
  it("turns per-minute byte counts into bytes per second", () => {
    const [point] = hostPoints([bucket()]);
    expect(point).toMatchObject({ cpu: 10, memory: 20, disk: 30, receive: 100, transmit: 20 });
  });

  it("drops buckets whose time cannot be read", () => {
    expect(hostPoints([bucket({ bucket: "not a date" }), bucket()])).toHaveLength(1);
  });
});

describe("networkTotals and averagePercent", () => {
  it("sums traffic over the range", () => {
    expect(networkTotals([bucket(), bucket()])).toEqual({ received: 12000, transmitted: 2400 });
  });

  it("averages, and is zero for nothing", () => {
    expect(averagePercent([10, 20, 30])).toBe(20);
    expect(averagePercent([])).toBe(0);
  });
});
