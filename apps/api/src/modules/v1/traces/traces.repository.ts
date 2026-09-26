import { Injectable } from '@nestjs/common';
import { QUICKWIT_INDEXES, QuickwitService } from '@soonwhy/shared';
import { quickwitTerm, quickwitTenantQuery, quickwitTimestamp } from '../../../common/quickwit/query';

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
  constructor(private readonly quickwit: QuickwitService) {}

  async listTraces(params: {
    orgId: string;
    projectId: string;
    from: string;
    to: string;
    limit: number;
    cursor?: { ts: string; traceId: string };
    q?: string;
  }): Promise<TraceListRow[]> {
    const result = await this.quickwit.search<TraceRow>(QUICKWIT_INDEXES.traces, {
      query: quickwitTenantQuery(params.orgId, params.projectId, params.q ? quickwitTerm('traceId', params.q) : '*'),
      startTimestamp: quickwitTimestamp(params.from),
      endTimestamp: quickwitTimestamp(params.to),
      maxHits: 0,
      aggregations: {
        traces: {
          terms: {
            field: 'traceId',
            size: params.limit,
          },
          aggs: {
            min_timestamp: { min: { field: 'timestamp' } },
            max_timestamp: { max: { field: 'timestamp' } },
            span_count: { value_count: { field: 'spanId' } },
          },
        },
      },
    });

    const aggregation = result.aggregations?.traces as TraceAggregation | undefined;
    return (aggregation?.buckets ?? []).map((bucket) => ({
      traceId: bucket.key,
      name: '',
      start: new Date(bucket.min_timestamp?.value ?? 0).toISOString(),
      end: new Date(bucket.max_timestamp?.value ?? 0).toISOString(),
      spanCount: bucket.span_count?.value ?? bucket.doc_count,
    }));
  }

  async getTraceSpans(params: {
    orgId: string;
    projectId: string;
    traceId: string;
  }): Promise<TraceRow[]> {
    const result = await this.quickwit.search<TraceRow>(QUICKWIT_INDEXES.traces, {
      query: quickwitTenantQuery(
        params.orgId,
        params.projectId,
        quickwitTerm('traceId', params.traceId),
      ),
      maxHits: 10000,
      sortBy: ['timestamp'],
    });

    return result.hits.flatMap((hit) => (hit._source ? [hit._source] : []));
  }
}
