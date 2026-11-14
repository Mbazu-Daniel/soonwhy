import { Injectable } from "@nestjs/common";
import { QUICKWIT_INDEXES, QuickwitService } from "@soonwhy/shared";
import {
  quickwitSource,
  quickwitTerm,
  quickwitTenantQuery,
  quickwitTimestamp,
} from "../../../common/quickwit/query";
import {
  histogramPercentile,
  mergeHistogramSources,
  summaryPercentile,
} from "./percentiles";
import type {
  HistogramSource,
  MetricPercentileQuery,
  MetricPercentiles,
} from "./percentiles.types";

import {
  MAX_SERVICES,
  STATUS_RANGES,
} from "./request-summary.constants";
import {
  errorCountOf,
  errorRateOf,
  percentileOf,
  statusCountsOf,
} from "./request-summary";
import type {
  RawRequestSummary,
  ServiceAggregation,
  ServiceRequestSummary,
  SummaryAggregation,
} from "./request-summary.types";

export interface MetricsBucket {
  bucket: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
  _2xx: number;
  _3xx: number;
  _4xx: number;
  _5xx: number;
}

export interface HostMetricsBucket {
  bucket: string;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  network_in_bytes: number;
  network_out_bytes: number;
}

interface DateBucket {
  key_as_string?: string;
  doc_count: number;
  latency?: { values?: Record<string, number> };
  status?: {
    buckets?: Array<{ key: string; doc_count: number }>;
  };
  cpu_avg?: { value?: number };
  memory_avg?: { value?: number };
  disk_avg?: { value?: number };
  network_in?: { value?: number };
  network_out?: { value?: number };
}

interface MetricsAggregation {
  buckets?: DateBucket[];
}

@Injectable()
export class MetricsRepository {
  constructor(private readonly quickwit: QuickwitService) {}

  async queryMetrics(params: {
    orgId: string;
    projectId: string;
    from: string;
    to: string;
    interval: string;
    service: string;
  }): Promise<MetricsBucket[]> {
    const intervalMap: Record<string, string> = {
      "1m": "1m",
      "5m": "5m",
      "1h": "1h",
      "1d": "1d",
    };
    const fixedInterval = intervalMap[params.interval] || "5m";
    const filters = params.service
      ? [quickwitTerm("service", params.service)]
      : [];
    const result = await this.quickwit.search(QUICKWIT_INDEXES.requests, {
      query: quickwitTenantQuery(
        params.orgId,
        params.projectId,
        filters.length ? filters.join(" AND ") : "*",
      ),
      startTimestamp: quickwitTimestamp(params.from),
      endTimestamp: quickwitTimestamp(params.to),
      maxHits: 0,
      aggregations: {
        over_time: {
          date_histogram: {
            field: "timestamp",
            fixed_interval: fixedInterval,
            min_doc_count: 0,
          },
          aggs: {
            latency: {
              percentiles: {
                field: "duration",
                percents: [50, 95, 99],
              },
            },
            status: {
              range: {
                field: "statusCode",
                ranges: [
                  { from: 200, to: 300, key: "2xx" },
                  { from: 300, to: 400, key: "3xx" },
                  { from: 400, to: 500, key: "4xx" },
                  { from: 500, key: "5xx" },
                ],
              },
            },
          },
        },
      },
    });

    const aggregation = result.aggregations?.over_time as
      | MetricsAggregation
      | undefined;
    return (aggregation?.buckets ?? []).map((bucket) => {
      const status = new Map(
        (bucket.status?.buckets ?? []).map((entry) => [
          entry.key,
          entry.doc_count,
        ]),
      );
      const percentiles = bucket.latency?.values ?? {};
      return {
        bucket: bucket.key_as_string ?? "",
        count: bucket.doc_count,
        p50: percentiles["50.0"] ?? 0,
        p95: percentiles["95.0"] ?? 0,
        p99: percentiles["99.0"] ?? 0,
        _2xx: status.get("2xx") ?? 0,
        _3xx: status.get("3xx") ?? 0,
        _4xx: status.get("4xx") ?? 0,
        _5xx: status.get("5xx") ?? 0,
      };
    });
  }

  async querySummary(params: {
    orgId: string;
    projectId: string;
    from: string;
    to: string;
    service?: string;
  }): Promise<RawRequestSummary> {
    const filters = params.service ? [quickwitTerm("service", params.service)] : [];
    const result = await this.quickwit.search(QUICKWIT_INDEXES.requests, {
      query: quickwitTenantQuery(
        params.orgId,
        params.projectId,
        filters.length ? filters.join(" AND ") : "*",
      ),
      startTimestamp: quickwitTimestamp(params.from),
      endTimestamp: quickwitTimestamp(params.to),
      maxHits: 0,
      aggregations: {
        latency: { percentiles: { field: "duration", percents: [50, 95, 99] } },
        average: { avg: { field: "duration" } },
        status: { range: { field: "statusCode", ranges: STATUS_RANGES } },
      },
    });
    const aggregation = (result.aggregations ?? {}) as SummaryAggregation;
    return {
      total: result.num_hits,
      average: aggregation.average?.value ?? 0,
      p50: percentileOf(aggregation, 50),
      p95: percentileOf(aggregation, 95),
      p99: percentileOf(aggregation, 99),
      status: statusCountsOf(aggregation),
    };
  }

  async queryServiceSummaries(params: {
    orgId: string;
    projectId: string;
    from: string;
    to: string;
  }): Promise<ServiceRequestSummary[]> {
    const result = await this.quickwit.search(QUICKWIT_INDEXES.requests, {
      query: quickwitTenantQuery(params.orgId, params.projectId),
      startTimestamp: quickwitTimestamp(params.from),
      endTimestamp: quickwitTimestamp(params.to),
      maxHits: 0,
      aggregations: {
        services: {
          terms: { field: "service", size: MAX_SERVICES },
          aggs: {
            latency: { percentiles: { field: "duration", percents: [95] } },
            status: { range: { field: "statusCode", ranges: STATUS_RANGES } },
          },
        },
      },
    });
    const aggregation = result.aggregations?.services as ServiceAggregation | undefined;
    return (aggregation?.buckets ?? []).map((bucket) => {
      const errors = errorCountOf(statusCountsOf(bucket));
      return {
        service: bucket.key,
        requestCount: bucket.doc_count,
        errorCount: errors,
        errorRate: errorRateOf(errors, bucket.doc_count),
        p95Latency: Math.round(percentileOf(bucket, 95)),
      };
    });
  }

  async queryMetricPercentiles(
    params: MetricPercentileQuery,
  ): Promise<MetricPercentiles> {
    const filters = [
      quickwitTerm("name", params.metricName),
      `(${quickwitTerm("metricType", "histogram")} OR ${quickwitTerm("metricType", "summary")})`,
      ...(params.service ? [quickwitTerm("service", params.service)] : []),
    ];
    const result = await this.quickwit.search<HistogramSource>(
      QUICKWIT_INDEXES.metrics,
      {
        query: quickwitTenantQuery(
          params.orgId,
          params.projectId,
          filters.join(" AND "),
        ),
        startTimestamp: quickwitTimestamp(params.from),
        endTimestamp: quickwitTimestamp(params.to),
        maxHits: 10_000,
        sortBy: ["timestamp"],
      },
    );

    const sources = result.hits.flatMap((hit) => {
      const source = quickwitSource<HistogramSource>(hit);
      return source ? [source] : [];
    });
    const merged = mergeHistogramSources(sources);
    const total = merged.counts.reduce((sum, count) => sum + count, 0);

    if (total > 0) {
      return {
        metricName: params.metricName,
        count: total,
        p50: histogramPercentile(merged.bounds, merged.counts, 50),
        p95: histogramPercentile(merged.bounds, merged.counts, 95),
        p99: histogramPercentile(merged.bounds, merged.counts, 99),
      };
    }

    return {
      metricName: params.metricName,
      count: merged.summaryCount,
      p50: summaryPercentile(merged.summaryQuantiles, 50),
      p95: summaryPercentile(merged.summaryQuantiles, 95),
      p99: summaryPercentile(merged.summaryQuantiles, 99),
    };
  }

  async queryHostMetrics(params: {
    orgId: string;
    projectId: string;
    from: string;
    to: string;
    interval: string;
  }): Promise<HostMetricsBucket[]> {
    const intervalMap: Record<string, string> = {
      "1m": "1m",
      "5m": "5m",
      "1h": "1h",
      "1d": "1d",
    };
    const fixedInterval = intervalMap[params.interval] || "1m";

    const result = await this.quickwit.search(QUICKWIT_INDEXES.metrics, {
      query: quickwitTenantQuery(
        params.orgId,
        params.projectId,
        `(system.cpu.utilization OR system.memory.utilization OR system.filesystem.utilization)`,
      ),
      startTimestamp: quickwitTimestamp(params.from),
      endTimestamp: quickwitTimestamp(params.to),
      maxHits: 0,
      aggregations: {
        over_time: {
          date_histogram: {
            field: "timestamp",
            fixed_interval: fixedInterval,
            min_doc_count: 0,
          },
          aggs: {
            cpu_avg: {
              avg: { field: "system.cpu.utilization" },
            },
            memory_avg: {
              avg: { field: "system.memory.utilization" },
            },
            disk_avg: {
              avg: { field: "system.filesystem.utilization" },
            },
            network_in: {
              sum: { field: "system.network.in" },
            },
            network_out: {
              sum: { field: "system.network.out" },
            },
          },
        },
      },
    });

    const aggregation = result.aggregations?.over_time as MetricsAggregation | undefined;
    return (aggregation?.buckets ?? []).map((bucket) => ({
      bucket: bucket.key_as_string ?? "",
      cpu_percent: (bucket.cpu_avg?.value as number) ?? 0,
      memory_percent: (bucket.memory_avg?.value as number) ?? 0,
      disk_percent: (bucket.disk_avg?.value as number) ?? 0,
      network_in_bytes: (bucket.network_in?.value as number) ?? 0,
      network_out_bytes: (bucket.network_out?.value as number) ?? 0,
    }));
  }
}
