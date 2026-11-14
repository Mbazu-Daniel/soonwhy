import { Injectable } from "@nestjs/common";
import { quickwitSource, quickwitTerm } from "../../../common/quickwit/query";
import { TelemetryQueryService } from "../../../common/telemetry";

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
}

export interface TraceListRow {
  traceId: string;
  name: string;
  rootService: string;
  rootOperation: string;
  start: string;
  end: string;
  startTime: string;
  durationMs: number;
  spanCount: number;
  status: "ok" | "error";
}

const MAX_DATE_MS = 8.64e15;

interface TraceAggregation {
  buckets?: Array<{
    key: string;
    doc_count: number;
    min_timestamp?: { value: number | null };
    max_timestamp?: { value: number | null };
    span_count?: { value: number };
  }>;
}

@Injectable()
export class TracesRepository {
  constructor(private readonly telemetryQuery: TelemetryQueryService) {}

  async listTraces(params: {
    orgId: string;
    projectId: string;
    from: string;
    to: string;
    limit: number;
    cursor?: { ts: string; traceId: string };
    q?: string;
    service?: string;
  }): Promise<TraceListRow[]> {
    const result = await this.telemetryQuery.search<TraceRow>(
      "traces",
      {
        orgId: params.orgId,
        projectId: params.projectId,
        from: params.from,
        to: params.to,
        filters: [
          ...(params.q ? [quickwitTerm("traceId", params.q)] : []),
          ...(params.service ? [quickwitTerm("service", params.service)] : []),
        ],
      },
      {
        maxHits: 0,
        aggregations: {
          traces: {
            terms: {
              field: "traceId",
              size: params.limit,
            },
            aggs: {
              min_timestamp: { min: { field: "timestamp" } },
              max_timestamp: { max: { field: "timestamp" } },
              span_count: { value_count: { field: "spanId" } },
            },
          },
        },
      },
    );

    const aggregation = result.aggregations?.traces as
      | TraceAggregation
      | undefined;
    const toIso = (value: number | null | undefined) => {
      let t = Number(value);
      if (!Number.isFinite(t)) t = 0;
      if (t > MAX_DATE_MS) t = Math.floor(t / 1_000_000);
      return new Date(Math.max(Math.min(t, MAX_DATE_MS), -MAX_DATE_MS)).toISOString();
    };
    return (
      await Promise.all(
        (aggregation?.buckets ?? []).map(async (bucket) => {
          const spans = await this.spansFor(
            params.orgId,
            params.projectId,
            params.from,
            params.to,
            bucket.key,
          );
          const spanCount =
            bucket.span_count?.value ??
            bucket.doc_count ??
            spans.length;
          if (spans.length === 0) {
            const start = toIso(bucket.min_timestamp?.value);
            return {
              traceId: bucket.key,
              name: "",
              rootService: "",
              rootOperation: "",
              start,
              end: toIso(bucket.max_timestamp?.value),
              startTime: start,
              durationMs: 0,
              spanCount,
              status: "ok" as const,
            };
          }
          const timestamps = spans.map((span) => Date.parse(span.timestamp));
          const starts = timestamps.filter((ts) => Number.isFinite(ts));
          const startMs = Math.min(...starts);
          const endMs = Math.max(
            ...spans.map(
              (span) =>
                Date.parse(span.timestamp) + (Number(span.duration) || 0),
            ),
          );
          const durationMs = Math.max(0, endMs - startMs);
          const root =
            spans.find((span) => !span.parentSpanId) ?? spans[0]!;
          const errored = spans.some(
            (span) => Number(span.statusCode ?? 0) >= 2,
          );
          return {
            traceId: bucket.key,
            name: root.name,
            rootService: root.service,
            rootOperation: root.name,
            start: new Date(startMs).toISOString(),
            end: new Date(endMs).toISOString(),
            startTime: new Date(startMs).toISOString(),
            durationMs,
            spanCount,
            status: (errored ? "error" : "ok") as "ok" | "error",
          };
        }),
      )
    ).sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );
  }

  private async spansFor(
    orgId: string,
    projectId: string,
    from: string | undefined,
    to: string | undefined,
    traceId: string,
  ): Promise<TraceRow[]> {
    const fromIso = from ?? new Date(0).toISOString();
    const toIso = to ?? new Date().toISOString();
    const result = await this.telemetryQuery.search<TraceRow>(
      "traces",
      {
        orgId,
        projectId,
        from: fromIso,
        to: toIso,
        filters: [quickwitTerm("traceId", traceId)],
      },
      { maxHits: 1000, sortBy: ["timestamp"] },
    );
    return result.hits.flatMap((hit) => {
      const source = quickwitSource<TraceRow>(hit);
      return source ? [source] : [];
    });
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
