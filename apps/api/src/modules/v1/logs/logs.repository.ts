import { Injectable } from "@nestjs/common";
import { quickwitTerm } from "../../../common/quickwit/query";
import { TelemetryQueryService } from "../../../common/telemetry";
import { histogramInterval } from "./histogram-interval";
import { FIELD_SAMPLE_SIZE } from "./logs.constants";

export interface RawLogRow {
  id: string;
  timestamp: string;
  level: string;
  service: string;
  message: string;
  traceId?: string;
  spanId?: string;
  stackTrace?: string;
  attributes: Record<string, unknown> | string;
}

export interface LogFilter {
  orgId: string;
  projectId: string;
  from: string;
  to: string;
  level: string;
  service: string;
  q: string;
  traceId?: string;
  spanId?: string;
}

interface TermBuckets {
  buckets?: Array<{ key: string | number; doc_count: number }>;
}

function filtersOf(params: LogFilter): string[] {
  const filters: string[] = [];
  if (params.level && params.level !== "all") filters.push(quickwitTerm("level", params.level));
  if (params.service) filters.push(quickwitTerm("service", params.service));
  if (params.traceId) filters.push(quickwitTerm("traceId", params.traceId));
  if (params.spanId) filters.push(quickwitTerm("spanId", params.spanId));
  if (params.q) filters.push(`(${params.q})`);
  return filters;
}

function scopeOf(params: LogFilter) {
  return {
    orgId: params.orgId,
    projectId: params.projectId,
    from: params.from,
    to: params.to,
    filters: filtersOf(params),
  };
}

@Injectable()
export class LogsRepository {
  constructor(private readonly telemetryQuery: TelemetryQueryService) {}

  async queryHistogram(params: LogFilter) {
    const result = await this.telemetryQuery.search<never>("logs", scopeOf(params), {
      maxHits: 0,
      aggregations: {
        timeline: {
          date_histogram: {
            field: "timestamp",
            fixed_interval: histogramInterval(params.from, params.to),
            min_doc_count: 0,
          },
        },
        levels: { terms: { field: "level", size: 10 } },
        services: { terms: { field: "service", size: 25 } },
      },
    });
    return { aggregations: result.aggregations ?? {}, total: result.num_hits };
  }

  async queryLogs(params: LogFilter & { limit: number; offset: number }) {
    const result = await this.telemetryQuery.search<RawLogRow>("logs", scopeOf(params), {
      maxHits: params.limit,
      startOffset: params.offset,
      sortBy: ["timestamp:desc"],
    });
    const rows = result.hits.flatMap((hit) => {
      const source = (hit as { _source?: RawLogRow })._source ?? (hit as unknown as RawLogRow);
      return source ? [source] : [];
    });
    return { rows, total: result.num_hits };
  }

  async queryFieldSample(params: LogFilter): Promise<Array<{ attributes?: unknown }>> {
    const result = await this.telemetryQuery.search<{ attributes?: unknown }>("logs", scopeOf(params), {
      maxHits: FIELD_SAMPLE_SIZE,
      sortBy: ["timestamp:desc"],
    });
    return result.hits.flatMap((hit) => {
      const source = (hit as { _source?: { attributes?: unknown } })._source ?? (hit as { attributes?: unknown });
      return source ? [source] : [];
    });
  }

  async queryFieldValues(params: LogFilter & { field: string; size: number }) {
    const result = await this.telemetryQuery.search<never>("logs", scopeOf(params), {
      maxHits: 0,
      aggregations: { values: { terms: { field: params.field, size: params.size } } },
    });
    const terms = result.aggregations?.values as TermBuckets | undefined;
    return (terms?.buckets ?? []).map((bucket) => ({
      value: String(bucket.key),
      count: bucket.doc_count,
    }));
  }
}
