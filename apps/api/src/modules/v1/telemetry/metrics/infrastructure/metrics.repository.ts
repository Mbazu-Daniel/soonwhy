import { Injectable } from "@nestjs/common";
import { QuickwitService } from "@soonwhy/shared";
import { quickwitSource, quickwitTerm, quickwitTimestamp } from "../../../../../common/quickwit/query";
import { histogramPercentile, mergeHistogramSources, summaryPercentile } from "../domain/percentiles";
import type { HistogramSource, MetricPercentileQuery, MetricPercentiles } from "../domain/percentiles.types";
import { FAILED_REQUEST_FILTER, REQUEST_SPAN_FILTER } from "../../../../../common/telemetry/span-filters";
import { HTTP_STATUS_CLASS_RANGES, MAX_SERVICES } from "../domain/request-summary.constants";
import { errorCountOf, errorRateOf, percentileOf, spanStatusCounts } from "../domain/request-summary";
import type { RawRequestSummary, ServiceAggregation, ServiceRequestSummary, SummaryAggregation } from "../domain/request-summary.types";
import { searchTenant } from "../../../../../common/telemetry/tenant-search";
import { mergeHostMetrics, trafficSearch, utilizationSearch } from "../domain/host-metrics";
import { CPU_UTILIZATION } from "../domain/host-metrics.constants";
import type { HostLevelBucket, HostMetricsBucket, HostTrafficBucket } from "../domain/host-metrics.types";
import type { MetricsBucket } from "../domain/metrics.repository.types";
import type { MetricsAggregation } from "../domain/metrics.repository.types";

function bucketsOf<T>(result: { aggregations?: Record<string, unknown> }): T[] {
  const aggregation = result.aggregations?.over_time as { buckets?: T[] } | undefined;
  return aggregation?.buckets ?? [];
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

  async queryTopFailingRoutes(
    params: { orgId: string; projectId: string; from: string; to: string },
    limit: number,
  ): Promise<{ route: string; failures: number }[]> {
    const result = await this.requestSearch(
      params,
      { routes: { terms: { field: "name", size: limit } } },
      [FAILED_REQUEST_FILTER],
    );
    const aggregation = result.aggregations?.routes as ServiceAggregation | undefined;
    return (aggregation?.buckets ?? []).map((bucket) => ({ route: bucket.key, failures: bucket.doc_count }));
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
      const p95 = percentileOf(bucket, 95);
      return {
        service: bucket.key,
        requestCount: bucket.doc_count,
        errorCount: errors,
        errorRate: errorRateOf(errors, bucket.doc_count),
        p95Latency: Number.isFinite(p95) ? Number(p95.toPrecision(12)) : 0,
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

  async countHostSamples(params: { orgId: string; projectId: string; from: string; to: string }): Promise<number> {
    const result = await searchTenant(this.quickwit, "metrics", params, {
      filter: quickwitTerm("name", CPU_UTILIZATION),
      startTimestamp: quickwitTimestamp(params.from),
      endTimestamp: quickwitTimestamp(params.to),
      maxHits: 0,
    });
    return result.num_hits;
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
