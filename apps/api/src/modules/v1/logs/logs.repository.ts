import { Injectable } from '@nestjs/common';
import { QuickwitService } from '@soonwhy/shared';
import { QUICKWIT_INDEXES } from '@soonwhy/shared';
import { quickwitTerm, quickwitTenantQuery, quickwitTimestamp } from '../../../common/quickwit/query';

export interface RawLogRow { id: string; timestamp: string; level: string; service: string; message: string; attributes: Record<string, unknown> | string; }

@Injectable()
export class LogsRepository {
  constructor(private readonly quickwit: QuickwitService) {}
  async queryHistogram(params: { orgId: string; projectId: string; from: string; to: string; level: string; service: string; q: string; }) {
    const filters: string[] = [];
    if (params.level && params.level !== 'all') filters.push(quickwitTerm('level', params.level));
    if (params.service) filters.push(quickwitTerm('service', params.service));
    if (params.q) filters.push(quickwitTerm('message', params.q));
    const query = quickwitTenantQuery(params.orgId, params.projectId, filters.length ? filters.join(' AND ') : '*');
    const result = await this.quickwit.search<never>(QUICKWIT_INDEXES.logs, { query, startTimestamp: quickwitTimestamp(params.from), endTimestamp: quickwitTimestamp(params.to), maxHits: 0, aggregations: {
      timeline: { date_histogram: { field: 'timestamp', fixed_interval: '1h', min_doc_count: 0 } },
      levels: { terms: { field: 'level', size: 10 } },
      services: { terms: { field: 'service', size: 25 } },
    }});
    return result.aggregations ?? {};
  }
  async queryLogs(params: { orgId: string; projectId: string; from: string; to: string; level: string; service: string; q: string; limit: number; cursor?: { ts: string; id: string }; }): Promise<RawLogRow[]> {
    const filters: string[] = [];
    if (params.level && params.level !== 'all') filters.push(quickwitTerm('level', params.level));
    if (params.service) filters.push(quickwitTerm('service', params.service));
    if (params.q) filters.push(quickwitTerm('message', params.q));
    const query = quickwitTenantQuery(params.orgId, params.projectId, filters.length ? filters.join(' AND ') : '*');
    const result = await this.quickwit.search<RawLogRow>(QUICKWIT_INDEXES.logs, { query, startTimestamp: quickwitTimestamp(params.from), endTimestamp: quickwitTimestamp(params.to), maxHits: params.limit, sortBy: ['timestamp:desc'] });
    return result.hits.flatMap((hit) => (hit._source ? [hit._source] : []));
  }
}
