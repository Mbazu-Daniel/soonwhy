import { Injectable } from "@nestjs/common";
import { quickwitTerm } from "../../../../../common/quickwit/query";
import { TelemetryQueryService } from "../../../../../common/telemetry";
import { clampHistogramStart, histogramInterval } from "../domain/histogram-interval";
import { CONTEXT_WINDOW_MS, FIELD_SAMPLE_SIZE, SAME_SECOND_LINES } from "../domain/logs.constants";
import type { RawLogRow, LogFilter } from "../domain/logs.repository.types";

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

  async queryHistogram(filter: LogFilter) {
    const params = { ...filter, from: clampHistogramStart(filter.from, filter.to) };
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

  async queryContext(params: {
    orgId: string;
    projectId: string;
    field: string;
    value: string;
    anchorMs: number;
    lines: number;
  }) {
    const filters = [quickwitTerm(params.field, params.value)];
    const scope = { orgId: params.orgId, projectId: params.projectId, filters };
    const secondStart = Math.floor(params.anchorMs / 1000) * 1000;
    const toIso = (ms: number) => new Date(ms).toISOString();
    const [earlier, sameSecond, later] = await Promise.all([
      this.telemetryQuery.search<RawLogRow>(
        "logs",
        { ...scope, from: toIso(secondStart - CONTEXT_WINDOW_MS), to: toIso(secondStart) },
        { maxHits: params.lines, sortBy: ["timestamp:desc"] },
      ),
      this.telemetryQuery.search<RawLogRow>(
        "logs",
        { ...scope, from: toIso(secondStart), to: toIso(secondStart + 1000) },
        { maxHits: SAME_SECOND_LINES, sortBy: ["timestamp"] },
      ),
      this.telemetryQuery.search<RawLogRow>(
        "logs",
        { ...scope, from: toIso(secondStart + 1000), to: toIso(secondStart + CONTEXT_WINDOW_MS) },
        { maxHits: params.lines, sortBy: ["timestamp"] },
      ),
    ]);
    const rowsOf = (hits: unknown[]) =>
      hits.flatMap((hit) => {
        const source = (hit as { _source?: RawLogRow })._source ?? (hit as RawLogRow);
        return source ? [source] : [];
      });
    const same = rowsOf(sameSecond.hits);
    return { before: [...rowsOf(earlier.hits), ...same], after: [...same, ...rowsOf(later.hits)] };
  }
}
