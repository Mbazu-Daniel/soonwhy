import { Injectable } from "@nestjs/common";
import { QuickwitService } from "@soonwhy/shared";
import {
  quickwitSource,
  quickwitTerm,
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

import { FAILED_REQUEST_FILTER, REQUEST_SPAN_FILTER } from "../../../common/telemetry/span-filters";
import {
  HTTP_STATUS_CLASS_RANGES,
  MAX_SERVICES,
} from "./request-summary.constants";
import {
  errorCountOf,
  errorRateOf,
  percentileOf,
  spanStatusCounts,
} from "./request-summary";
import type {
  RawRequestSummary,
  ServiceAggregation,
  ServiceRequestSummary,
  SummaryAggregation,
} from "./request-summary.types";
import { searchTenant } from "../../../common/telemetry/tenant-search";
import {
  mergeHostMetrics,
  trafficSearch,
  utilizationSearch,
} from "./host-metrics";
import type {
  HostLevelBucket,
  HostMetricsBucket,
  HostTrafficBucket,
} from "./host-metrics.types";

export type { HostMetricsBucket } from "./host-metrics.types";

function bucketsOf<T>(result: { aggregations?: Record<string, unknown> }): T[] {
  const aggregation = result.aggregations?.over_time as { buckets?: T[] } | undefined;
  return aggregation?.buckets ?? [];
}

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

interface DateBucket {
  key_as_string?: string;
  doc_count: number;
  latency?: { values?: Record<string, number> };
  status?: {
    buckets?: Array<{ key: string; doc_count: number }>;
  };
}

interface MetricsAggregation {
  buckets?: DateBucket[];
}

@Injectable()
export class MetricsRepository {
  constructor(private readonly quickwit: QuickwitService) {}

  private requestFilter(params: { service?: string }, extra: string[] = []): string {
    const filters = [REQUEST_SPAN_FILTER, ...(params.service ? [quickwitTerm("service", params.service)] : []), ...extra];
    return filters.join(" AND ");
  }

  private requestSearch(
    params: { orgId: string; projectId: string; from: string; to: string; service?: string },
    aggregations: Record<string, unknown>,
    extra: string[] = [],
  ) {
    return searchTenant(this.quickwit, "traces", params, {
      filter: this.requestFilter(params, extra),
      startTimestamp: quickwitTimestamp(params.from),
      endTimestamp: quickwitTimestamp(params.to),
      maxHits: 0,
      aggregations,
    });
  }

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
    const timeline = {
      date_histogram: {
        field: "timestamp",
        fixed_interval: intervalMap[params.interval] || "5m",
        min_doc_count: 0,
      },
    };
    const [all, failed] = await Promise.all([
      this.requestSearch(params, {
        over_time: {
          ...timeline,
          aggs: {
            latency: { percentiles: { field: "duration", percents: [50, 95, 99] } },
            status: { range: { field: "httpStatusCode", ranges: HTTP_STATUS_CLASS_RANGES } },
          },
        },
      }),
      this.requestSearch(params, { over_time: timeline }, [FAILED_REQUEST_FILTER]),
    ]);
    const failedByBucket = new Map(
      ((failed.aggregations?.over_time as MetricsAggregation | undefined)?.buckets ?? []).map((bucket) => [
        bucket.key_as_string ?? "",
        bucket.doc_count,
      ]),
    );
    const aggregation = all.aggregations?.over_time as MetricsAggregation | undefined;
    return (aggregation?.buckets ?? []).map((bucket) => {
      const key = bucket.key_as_string ?? "";
      const status = spanStatusCounts(bucket.doc_count, failedByBucket.get(key) ?? 0, bucket);
      const percentiles = bucket.latency?.values ?? {};
      return {
        bucket: key,
        count: bucket.doc_count,
        p50: percentiles["50.0"] ?? 0,
        p95: percentiles["95.0"] ?? 0,
        p99: percentiles["99.0"] ?? 0,
        ...status,
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
    const [all, failed] = await Promise.all([
      this.requestSearch(params, {
        latency: { percentiles: { field: "duration", percents: [50, 95, 99] } },
        average: { avg: { field: "duration" } },
        status: { range: { field: "httpStatusCode", ranges: HTTP_STATUS_CLASS_RANGES } },
      }),
      this.requestSearch(params, {}, [FAILED_REQUEST_FILTER]),
    ]);
    const aggregation = (all.aggregations ?? {}) as SummaryAggregation;
    return {
      total: all.num_hits,
      average: aggregation.average?.value ?? 0,
      p50: percentileOf(aggregation, 50),
      p95: percentileOf(aggregation, 95),
      p99: percentileOf(aggregation, 99),
      status: spanStatusCounts(all.num_hits, failed.num_hits, aggregation),
    };
  }

  async queryServiceSummaries(params: {
    orgId: string;
    projectId: string;
    from: string;
    to: string;
  }): Promise<ServiceRequestSummary[]> {
    const services = { terms: { field: "service", size: MAX_SERVICES } };
    const [all, failed] = await Promise.all([
      this.requestSearch(params, {
        services: {
          ...services,
          aggs: {
            latency: { percentiles: { field: "duration", percents: [95] } },
            status: { range: { field: "httpStatusCode", ranges: HTTP_STATUS_CLASS_RANGES } },
          },
        },
      }),
      this.requestSearch(params, { services }, [FAILED_REQUEST_FILTER]),
    ]);
    const failedByService = new Map(
      ((failed.aggregations?.services as ServiceAggregation | undefined)?.buckets ?? []).map((bucket) => [
        bucket.key,
        bucket.doc_count,
      ]),
    );
    const aggregation = all.aggregations?.services as ServiceAggregation | undefined;
    return (aggregation?.buckets ?? []).map((bucket) => {
      const errors = errorCountOf(
        spanStatusCounts(bucket.doc_count, failedByService.get(bucket.key) ?? 0, bucket),
      );
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
    const result = await searchTenant<HistogramSource>(this.quickwit, "metrics", params, {
        filter: filters.join(" AND "),
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
    const [levels, received, transmitted] = await Promise.all([
      searchTenant(this.quickwit, "metrics", params, utilizationSearch(params)),
      searchTenant(this.quickwit, "metrics", params, trafficSearch(params, "receive")),
      searchTenant(this.quickwit, "metrics", params, trafficSearch(params, "transmit")),
    ]);
    return mergeHostMetrics({
      levels: bucketsOf<HostLevelBucket>(levels),
      received: bucketsOf<HostTrafficBucket>(received),
      transmitted: bucketsOf<HostTrafficBucket>(transmitted),
    });
  }
}
