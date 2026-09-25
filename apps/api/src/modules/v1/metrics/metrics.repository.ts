import { Injectable } from '@nestjs/common';
import { QUICKWIT_INDEXES, QuickwitService } from '@soonwhy/shared';
import { quickwitTerm, quickwitTenantQuery, quickwitTimestamp } from '../../../common/quickwit/query';

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

  async queryMetrics(params: {
    orgId: string;
    projectId: string;
    from: string;
    to: string;
    interval: string;
    service: string;
  }): Promise<MetricsBucket[]> {
    const intervalMap: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '1h': '1h',
      '1d': '1d',
    };
    const fixedInterval = intervalMap[params.interval] || '5m';
    const filters = params.service ? [quickwitTerm('service', params.service)] : [];
    const result = await this.quickwit.search(QUICKWIT_INDEXES.requests, {
      query: quickwitTenantQuery(
        params.orgId,
        params.projectId,
        filters.length ? filters.join(' AND ') : '*',
      ),
      startTimestamp: quickwitTimestamp(params.from),
      endTimestamp: quickwitTimestamp(params.to),
      maxHits: 0,
      aggregations: {
        over_time: {
          date_histogram: {
            field: 'timestamp',
            fixed_interval: fixedInterval,
            min_doc_count: 0,
          },
          aggs: {
            latency: {
              percentiles: {
                field: 'duration',
                percents: [50, 95, 99],
              },
            },
            status: {
              range: {
                field: 'statusCode',
                ranges: [
                  { from: 200, to: 300, key: '2xx' },
                  { from: 300, to: 400, key: '3xx' },
                  { from: 400, to: 500, key: '4xx' },
                  { from: 500, key: '5xx' },
                ],
              },
            },
          },
        },
      },
    });

    const aggregation = result.aggregations?.over_time as MetricsAggregation | undefined;
    return (aggregation?.buckets ?? []).map((bucket) => {
      const status = new Map(
        (bucket.status?.buckets ?? []).map((entry) => [entry.key, entry.doc_count]),
      );
      const percentiles = bucket.latency?.values ?? {};
      return {
        bucket: bucket.key_as_string ?? '',
        count: bucket.doc_count,
        p50: percentiles['50.0'] ?? 0,
        p95: percentiles['95.0'] ?? 0,
        p99: percentiles['99.0'] ?? 0,
        _2xx: status.get('2xx') ?? 0,
        _3xx: status.get('3xx') ?? 0,
        _4xx: status.get('4xx') ?? 0,
        _5xx: status.get('5xx') ?? 0,
      };
    });
  }
}
