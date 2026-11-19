import { quickwitTerm, quickwitTimestamp } from "../../../../../common/quickwit/query";
import type { TenantSearchInput } from "../../../../../common/telemetry/tenant-search.types";
import type { HostLevelBucket, HostMetricsBucket, HostMetricsResults, HostTrafficBucket } from "./host-metrics.types";
import { CPU_UTILIZATION, MEMORY_UTILIZATION, DISK_UTILIZATION, NETWORK_IO } from "./host-metrics.constants";

const INTERVALS: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "1h": "1h",
  "1d": "1d",
};

interface HostRange {
  from: string;
  to: string;
  interval: string;
}

function window(range: HostRange) {
  return {
    startTimestamp: quickwitTimestamp(range.from),
    endTimestamp: quickwitTimestamp(range.to),
    maxHits: 0,
  };
}

function overTime(range: HostRange, aggs: Record<string, unknown>) {
  return {
    over_time: {
      date_histogram: {
        field: "timestamp",
        fixed_interval: INTERVALS[range.interval] ?? "1m",
        min_doc_count: 0,
      },
      aggs,
    },
  };
}

function metricState(name: string, state: string): string {
  return `(${quickwitTerm("name", name)} AND ${quickwitTerm("attributes.state", state)})`;
}

export function utilizationSearch(range: HostRange): TenantSearchInput {
  return {
    filter: [
      metricState(CPU_UTILIZATION, "idle"),
      metricState(MEMORY_UTILIZATION, "used"),
      quickwitTerm("name", DISK_UTILIZATION),
    ].join(" OR "),
    ...window(range),
    aggregations: overTime(range, {
      by_name: {
        terms: { field: "name", size: 5 },
        aggs: { average: { avg: { field: "value" } } },
      },
    }),
  };
}

export function trafficSearch(
  range: HostRange,
  direction: "receive" | "transmit",
): TenantSearchInput {
  return {
    filter: `${quickwitTerm("name", NETWORK_IO)} AND ${quickwitTerm("attributes.direction", direction)}`,
    ...window(range),
    aggregations: overTime(range, { total: { sum: { field: "value" } } }),
  };
}

function levelOf(bucket: HostLevelBucket | undefined, name: string): number | null {
  const found = bucket?.by_name?.buckets?.find((entry) => entry.key === name);
  const value = found?.average?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function percent(ratio: number | null): number {
  if (ratio === null) return 0;
  return Math.min(100, Math.max(0, ratio * 100));
}

function trafficByBucket(buckets: HostTrafficBucket[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const bucket of buckets) {
    const total = bucket.total?.value;
    totals.set(bucket.key_as_string ?? "", typeof total === "number" ? total : 0);
  }
  return totals;
}

export function mergeHostMetrics(results: HostMetricsResults): HostMetricsBucket[] {
  const received = trafficByBucket(results.received);
  const transmitted = trafficByBucket(results.transmitted);
  return results.levels.map((bucket) => {
    const key = bucket.key_as_string ?? "";
    const idle = levelOf(bucket, CPU_UTILIZATION);
    return {
      bucket: key,
      cpu_percent: idle === null ? 0 : percent(1 - idle),
      memory_percent: percent(levelOf(bucket, MEMORY_UTILIZATION)),
      disk_percent: percent(levelOf(bucket, DISK_UTILIZATION)),
      network_in_bytes: received.get(key) ?? 0,
      network_out_bytes: transmitted.get(key) ?? 0,
    };
  });
}
