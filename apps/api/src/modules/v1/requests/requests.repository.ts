import { Injectable } from '@nestjs/common';
import { QUICKWIT_INDEXES, QuickwitService } from '@soonwhy/shared';
import { quickwitTenantQuery, quickwitTimestamp } from '../../../common/quickwit/query';

export interface RequestStat {
  url: string;
  method: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
}

interface MethodBucket {
  key: string;
  doc_count: number;
  latency?: { values?: Record<string, number> };
  status?: { buckets?: Array<{ key: string; doc_count: number }> };
}

interface UrlBucket {
  key: string;
  doc_count: number;
  methods?: { buckets?: MethodBucket[] };
}

@Injectable()
export class RequestsRepository {
  constructor(private readonly quickwit: QuickwitService) {}

  async queryStats(params: {
    orgId: string;
    projectId: string;
    from: string;
    to: string;
  }): Promise<RequestStat[]> {
    const result = await this.quickwit.search(QUICKWIT_INDEXES.requests, {
      query: quickwitTenantQuery(params.orgId, params.projectId),
      startTimestamp: quickwitTimestamp(params.from),
      endTimestamp: quickwitTimestamp(params.to),
      maxHits: 0,
      aggregations: {
        urls: {
          terms: {
            field: 'url',
            size: 50,
            order: { _key: 'asc' },
          },
          aggs: {
            methods: {
              terms: {
                field: 'method',
                size: 20,
                order: { _key: 'asc' },
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
                      { from: 400, to: 600, key: 'errors' },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    });

    const urls = result.aggregations?.urls as { buckets?: UrlBucket[] } | undefined;
    return (urls?.buckets ?? []).flatMap((urlBucket) =>
      (urlBucket.methods?.buckets ?? []).map((methodBucket) => {
        const percentiles = methodBucket.latency?.values ?? {};
        const errors = methodBucket.status?.buckets?.find((bucket) => bucket.key === 'errors')?.doc_count ?? 0;
        return {
          url: urlBucket.key,
          method: methodBucket.key,
          count: methodBucket.doc_count,
          p50: percentiles['50.0'] ?? 0,
          p95: percentiles['95.0'] ?? 0,
          p99: percentiles['99.0'] ?? 0,
          errorRate: methodBucket.doc_count ? (errors / methodBucket.doc_count) * 100 : 0,
        };
      }),
    ).sort((a, b) => b.count - a.count);
  }
}
