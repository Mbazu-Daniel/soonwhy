import { Injectable, Logger } from '@nestjs/common';

export interface QuickwitHit<T> {
  _source?: T;
  [key: string]: unknown;
}

export interface QuickwitSearchResponse<T> {
  hits: QuickwitHit<T>[];
  num_hits: number;
  elapsed_time_micros: number;
  aggregations?: Record<string, unknown>;
}

export interface QuickwitSearchInput {
  query: string;
  startTimestamp?: number;
  endTimestamp?: number;
  maxHits?: number;
  startOffset?: number;
  sortBy?: string[];
  searchField?: string[];
  aggregations?: Record<string, unknown>;
}

@Injectable()
export class QuickwitService {
  private readonly logger = new Logger(QuickwitService.name);
  private readonly baseUrl = (process.env.QUICKWIT_URL || 'http://localhost:7280').replace(/\/$/, '');

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Quickwit request failed (${response.status}): ${body}`);
    }

    return response.json() as Promise<T>;
  }

  async ensureIndex(indexId: string, config: Record<string, unknown>): Promise<void> {
    try {
      await this.request('/api/v1/indexes', {
        method: 'POST',
        body: JSON.stringify({ ...config, index_id: indexId }),
      });
      this.logger.log(`Quickwit index created: ${indexId}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('index `' + indexId + '` already exist')) {
        this.logger.debug(`Quickwit index already exists: ${indexId}`);
        return;
      }
      throw error;
    }
  }

  async ingest(indexId: string, documents: Record<string, unknown>[]): Promise<void> {
    if (documents.length === 0) return;
    const ndjson = documents.map((document) => JSON.stringify(document)).join('\n');
    await this.request(
      `/api/v1/${encodeURIComponent(indexId)}/ingest?commit=auto`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-ndjson' },
        body: ndjson,
      },
    );
  }

  async search<T>(indexId: string, input: QuickwitSearchInput): Promise<QuickwitSearchResponse<T>> {
    return this.request<QuickwitSearchResponse<T>>(
      `/api/v1/${encodeURIComponent(indexId)}/search`,
      {
        method: 'POST',
        body: JSON.stringify({
          query: input.query,
          max_hits: input.maxHits ?? 20,
          start_offset: input.startOffset ?? 0,
          ...(input.startTimestamp !== undefined ? { start_timestamp: input.startTimestamp } : {}),
          ...(input.endTimestamp !== undefined ? { end_timestamp: input.endTimestamp } : {}),
          ...(input.sortBy?.length ? { sort_by: input.sortBy.join(',') } : {}),
          ...(input.searchField?.length ? { search_field: input.searchField.join(',') } : {}),
          ...(input.aggregations ? { aggs: input.aggregations } : {}),
        }),
      },
    );
  }
}
