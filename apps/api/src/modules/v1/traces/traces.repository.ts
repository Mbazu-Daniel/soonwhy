import { Injectable } from "@nestjs/common";
import { quickwitTerm } from "../../../common/quickwit/query";
import { TelemetryQueryService } from "../../../common/telemetry";

export interface TraceRow {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  name: string;
  duration: number;
  timestamp: string;
  service: string;
}

export interface TraceListRow {
  traceId: string;
  name: string;
  start: string;
  end: string;
  spanCount: number;
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
      // Quickwit reports datetime min/max aggregations in nanoseconds
      if (t > MAX_DATE_MS) t = Math.floor(t / 1_000_000);
      return new Date(Math.max(Math.min(t, MAX_DATE_MS), -MAX_DATE_MS)).toISOString();
    };
    return (aggregation?.buckets ?? []).map((bucket) => ({
      traceId: bucket.key,
      name: "",
      start: toIso(bucket.min_timestamp?.value),
      end: toIso(bucket.max_timestamp?.value),
      spanCount: bucket.span_count?.value ?? bucket.doc_count,
    }));
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
        from: new Date(Date.now() - 86_400_000).toISOString(),
        to: new Date().toISOString(),
        filters: [quickwitTerm("traceId", params.traceId)],
      },
      { maxHits: 10000, sortBy: ["timestamp"] },
    );

    return result.hits.flatMap((hit) => (hit._source ? [hit._source] : []));
  }
}
