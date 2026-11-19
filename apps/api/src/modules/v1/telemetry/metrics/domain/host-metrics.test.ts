import { describe, expect, it } from "vitest";
import { mergeHostMetrics, trafficSearch, utilizationSearch } from "./host-metrics";
import { CPU_UTILIZATION, DISK_UTILIZATION, MEMORY_UTILIZATION } from "./host-metrics.constants";

const range = {
  from: "2026-11-15T10:00:00.000Z",
  to: "2026-11-15T11:00:00.000Z",
  interval: "5m",
};

function level(key: string, values: Record<string, number>) {
  return {
    key_as_string: key,
    by_name: {
      buckets: Object.entries(values).map(([name, value]) => ({
        key: name,
        average: { value },
      })),
    },
  };
}

describe("host metrics searches", () => {
  it("reads the idle share for cpu, the used share for memory, and disk as sent", () => {
    const { filter } = utilizationSearch(range);
    expect(filter).toContain(`"system.cpu.utilization"`);
    expect(filter).toContain(`attributes.state:"idle"`);
    expect(filter).toContain(`"system.memory.utilization"`);
    expect(filter?.match(/attributes\.state:"used"/g)).toHaveLength(1);
    expect(filter).toContain(`name:"system.filesystem.utilization"`);
    expect(filter).not.toMatch(/filesystem\.utilization"\s+AND\s+attributes\.state/);
  });

  it("buckets by the requested interval and falls back to one minute", () => {
    const fixed = (interval: string) =>
      (utilizationSearch({ ...range, interval }).aggregations as any).over_time
        .date_histogram.fixed_interval;
    expect(fixed("1h")).toBe("1h");
    expect(fixed("weird")).toBe("1m");
  });

  it("filters network traffic by direction", () => {
    expect(trafficSearch(range, "receive").filter).toContain(`attributes.direction:"receive"`);
    expect(trafficSearch(range, "transmit").filter).toContain(`attributes.direction:"transmit"`);
  });
});

describe("mergeHostMetrics", () => {
  it("turns the idle share into cpu usage and ratios into percentages", () => {
    const [bucket] = mergeHostMetrics({
      levels: [
        level("a", {
          [CPU_UTILIZATION]: 0.75,
          [MEMORY_UTILIZATION]: 0.5,
          [DISK_UTILIZATION]: 0.25,
        }),
      ],
      received: [{ key_as_string: "a", total: { value: 1200 } }],
      transmitted: [{ key_as_string: "a", total: { value: 300 } }],
    });
    expect(bucket).toEqual({
      bucket: "a",
      cpu_percent: 25,
      memory_percent: 50,
      disk_percent: 25,
      network_in_bytes: 1200,
      network_out_bytes: 300,
    });
  });

  it("reports zero, not a full cpu, for a bucket with no samples", () => {
    const [bucket] = mergeHostMetrics({
      levels: [{ key_as_string: "empty", by_name: { buckets: [] } }],
      received: [],
      transmitted: [],
    });
    expect(bucket).toMatchObject({
      cpu_percent: 0,
      memory_percent: 0,
      disk_percent: 0,
      network_in_bytes: 0,
      network_out_bytes: 0,
    });
  });

  it("keeps percentages inside zero to one hundred", () => {
    const [bucket] = mergeHostMetrics({
      levels: [level("a", { [CPU_UTILIZATION]: -0.2, [MEMORY_UTILIZATION]: 1.4 })],
      received: [],
      transmitted: [],
    });
    expect(bucket!.cpu_percent).toBe(100);
    expect(bucket!.memory_percent).toBe(100);
  });
});
