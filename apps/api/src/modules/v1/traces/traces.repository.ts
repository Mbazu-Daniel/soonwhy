import { Injectable } from "@nestjs/common";
import { quickwitSource, quickwitTerm } from "../../../common/quickwit/query";
import { TelemetryQueryService } from "../../../common/telemetry";
import { bucketInterval, clampBucketStart } from "../../../common/telemetry/bucket-interval";
import { ERROR_SPAN_FILTER } from "../../../common/telemetry/span-filters";
import { MAX_EXTENT_SPANS, MAX_SPAN_LOG_BUCKETS, MAX_STATUS_TRACE_IDS } from "./traces.constants";
import { traceFilters, traceIdList, type TraceFilter } from "./trace-filters";
import { traceExtents, type ExtentSpan } from "./trace-extent";
import { buildTraceList, type EntrySpan, type TraceListRow } from "./trace-list";

export type { TraceListRow } from "./trace-list";

export interface TraceRow {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  name: string;
  duration: number;
  timestamp: string;
  service: string;
  statusCode?: number | string;
  statusMessage?: string;
  attributes?: Record<string, unknown>;
  resourceAttributes?: Record<string, unknown>;
  events?: Array<{ name: string; timestamp: string; attributes: Record<string, unknown> }>;
  links?: Array<{ traceId: string; spanId: string; attributes: Record<string, unknown> }>;
  exceptionType?: string;
  exceptionMessage?: string;
  exceptionStacktrace?: string;
}

export interface TraceScope extends TraceFilter {
  orgId: string;
  projectId: string;
  from: string;
  to: string;
  status?: "ok" | "error";
}

interface CountBuckets {
  buckets?: Array<{ key: string | number; doc_count: number }>;
}

interface TimelineBuckets {
  buckets?: Array<{
    key: number;
    doc_count: number;
    p95?: { values?: Record<string, number | null> };
    avg?: { value?: number | null };
  }>;
}

@Injectable()
export class TracesRepository {
  constructor(private readonly telemetryQuery: TelemetryQueryService) {}

  private base(scope: TraceScope) {
    return { orgId: scope.orgId, projectId: scope.projectId, from: scope.from, to: scope.to };
  }

  private async errorTraceIds(scope: TraceScope): Promise<string[]> {
    const result = await this.telemetryQuery.search<never>(
      "traces",
      { ...this.base(scope), filters: [ERROR_SPAN_FILTER] },
      { maxHits: 0, aggregations: { ids: { terms: { field: "traceId", size: MAX_STATUS_TRACE_IDS } } } },
    );
    return ((result.aggregations?.ids as CountBuckets | undefined)?.buckets ?? []).map((bucket) => String(bucket.key));
  }

  private statusFilter(scope: TraceScope, ids: string[]): string[] | "none" {
    if (!scope.status) return [];
    if (scope.status === "error") return ids.length ? [traceIdList(ids)] : "none";
    return ids.length ? [`NOT ${traceIdList(ids)}`] : [];
  }

  async listTraces(scope: TraceScope & { limit: number; offset: number }): Promise<TraceListRow[]> {
    const status = this.statusFilter(scope, scope.status ? await this.errorTraceIds(scope) : []);
    if (status === "none") return [];
    const entries = await this.telemetryQuery.search<EntrySpan>(
      "traces",
      { ...this.base(scope), filters: [...traceFilters(scope), ...status] },
      { maxHits: scope.limit, startOffset: scope.offset, sortBy: ["timestamp:desc"] },
    );
    const spans = entries.hits.flatMap((hit) => {
      const source = quickwitSource<EntrySpan>(hit);
      return source ? [source] : [];
    });
    if (!spans.length) return [];
    const ids = [...new Set(spans.map((span) => span.traceId))];
    const inPage = [traceIdList(ids)];
    const [counts, errors, members] = await Promise.all([
      this.telemetryQuery.search<never>(
        "traces",
        { ...this.base(scope), filters: inPage },
        { maxHits: 0, aggregations: { ids: { terms: { field: "traceId", size: ids.length } } } },
      ),
      this.telemetryQuery.search<never>(
        "traces",
        { ...this.base(scope), filters: [...inPage, ERROR_SPAN_FILTER] },
        { maxHits: 0, aggregations: { ids: { terms: { field: "traceId", size: ids.length } } } },
      ),
      this.telemetryQuery.search<ExtentSpan>(
        "traces",
        { ...this.base(scope), filters: inPage },
        { maxHits: MAX_EXTENT_SPANS },
      ),
    ]);
    const extents = traceExtents(
      members.hits.flatMap((hit) => {
        const source = quickwitSource<ExtentSpan>(hit);
        return source ? [source] : [];
      }),
    );
    return buildTraceList(
      spans,
      counts.aggregations?.ids as CountBuckets | undefined,
      errors.aggregations?.ids as CountBuckets | undefined,
      extents,
    );
  }

  async traceStats(requested: TraceScope) {
    const scope = { ...requested, from: clampBucketStart(requested.from, requested.to) };
    const errorIds = await this.errorTraceIds(scope);
    const status = this.statusFilter(scope, errorIds);
    if (status === "none") return { interval: bucketInterval(scope.from, scope.to), buckets: [] };
    const failedFilter = errorIds.length ? traceIdList(errorIds) : ERROR_SPAN_FILTER;
    const interval = bucketInterval(scope.from, scope.to);
    const filters = [...traceFilters(scope), ...status];
    const timeline = {
      date_histogram: { field: "timestamp", fixed_interval: interval, min_doc_count: 0 },
    };
    const [requests, failed] = await Promise.all([
      this.telemetryQuery.search<never>("traces", { ...this.base(scope), filters }, {
        maxHits: 0,
        aggregations: {
          timeline: {
            ...timeline,
            aggs: {
              avg: { avg: { field: "duration" } },
              p95: { percentiles: { field: "duration", percents: [95] } },
            },
          },
        },
      }),
      this.telemetryQuery.search<never>("traces", { ...this.base(scope), filters: [...filters, failedFilter] }, {
        maxHits: 0,
        aggregations: { timeline },
      }),
    ]);
    const failedByTime = new Map(
      ((failed.aggregations?.timeline as TimelineBuckets | undefined)?.buckets ?? []).map((bucket) => [bucket.key, bucket.doc_count]),
    );
    const raw = (value: number | null | undefined): number => (Number.isFinite(value) ? Number((value as number).toPrecision(12)) : 0);
    const buckets = ((requests.aggregations?.timeline as TimelineBuckets | undefined)?.buckets ?? []).map((bucket) => ({
      timestamp: new Date(bucket.key).toISOString(),
      requests: bucket.doc_count,
      errors: failedByTime.get(bucket.key) ?? 0,
      avgMs: raw(bucket.avg?.value),
      p95Ms: raw(bucket.p95?.values?.["95.0"]),
    }));
    return { interval, buckets };
  }

  async spanLogCounts(params: { orgId: string; projectId: string; traceId: string }): Promise<Record<string, number>> {
    const result = await this.telemetryQuery.search<never>(
      "logs",
      {
        orgId: params.orgId,
        projectId: params.projectId,
        from: new Date(0).toISOString(),
        to: new Date(Date.now() + 86_400_000).toISOString(),
        filters: [quickwitTerm("traceId", params.traceId)],
      },
      { maxHits: 0, aggregations: { spans: { terms: { field: "spanId", size: MAX_SPAN_LOG_BUCKETS } } } },
    );
    const counts: Record<string, number> = {};
    for (const bucket of (result.aggregations?.spans as CountBuckets | undefined)?.buckets ?? []) {
      if (String(bucket.key)) counts[String(bucket.key)] = bucket.doc_count;
    }
    return counts;
  }

  async getTraceSpans(params: {
    orgId: string;
    projectId: string;
    traceId: string;
  }): Promise<TraceRow[]> {
    const result = await this.telemetryQuery.search<TraceRow>(
      "traces",
      {
        orgId: params.orgId,
        projectId: params.projectId,
        from: new Date(0).toISOString(),
        to: new Date(Date.now() + 86_400_000).toISOString(),
        filters: [quickwitTerm("traceId", params.traceId)],
      },
      { maxHits: 10000, sortBy: ["timestamp"] },
    );

    return result.hits.flatMap((hit) => {
      const source = quickwitSource<TraceRow>(hit);
      return source ? [source] : [];
    });
  }
}
