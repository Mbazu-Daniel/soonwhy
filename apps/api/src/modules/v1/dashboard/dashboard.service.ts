import { Injectable } from '@nestjs/common';
import { QUICKWIT_INDEXES, QuickwitService } from '@soonwhy/shared';
import { quickwitTenantQuery } from '../../../common/quickwit/query';

@Injectable()
export class DashboardService {
  private cache = new Map<string, { data: unknown; expires: number }>();
  private readonly CACHE_TTL = 30_000; // 30s

  constructor(private readonly quickwit: QuickwitService) {}

  private async cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.cache.get(key);
    if (hit && hit.expires > now) return hit.data as T;
    const data = await fn();
    this.cache.set(key, { data, expires: now + this.CACHE_TTL });
    return data;
  }

  async getOverview(orgId: string, projectId: string) {
    const cacheKey = `overview:${orgId}:${projectId}`;
    return this.cached(cacheKey, async () => {
      const [health, metrics] = await Promise.all([
        this.getHealthScoreRaw(orgId, projectId),
        this.getMetricsRaw(orgId, projectId),
      ]);
      return { ...health, ...metrics };
    });
  }

  private async getHealthScoreRaw(orgId: string, projectId: string) {
    const result = await this.quickwit.search(QUICKWIT_INDEXES.requests, {
      query: quickwitTenantQuery(orgId, projectId),
      startTimestamp: Math.floor((Date.now() - 86_400_000) / 1000),
      endTimestamp: Math.floor(Date.now() / 1000),
      maxHits: 0,
      aggregations: {
        latency: { percentiles: { field: 'duration', percents: [95] } },
        status: {
          range: {
            field: 'statusCode',
            ranges: [
              { from: 400, to: 500, key: '4xx' },
              { from: 500, key: '5xx' },
            ],
          },
        },
      },
    });
    const total = result.num_hits;
    const status = result.aggregations?.status as { buckets?: Array<{ key: string; doc_count: number }> } | undefined;
    const errors = (status?.buckets ?? []).reduce((sum, bucket) => sum + bucket.doc_count, 0);
    const latency = result.aggregations?.latency as { values?: Record<string, number> } | undefined;
    const p95 = latency?.values?.['95.0'] ?? 0;
    const errorRate = total ? (errors / total) * 100 : 0;
    return {
      score: total ? Math.max(0, Math.min(100, Math.round(100 - errorRate * 10 - p95 / 100))) : 0,
      errorRate: Math.round(errorRate * 100) / 100,
      requestRate: Math.round((total / 86400) * 10) / 10,
      avgLatency: Math.round(p95),
    };
  }

  private async getMetricsRaw(orgId: string, projectId: string) {
    const result = await this.quickwit.search(QUICKWIT_INDEXES.requests, {
      query: quickwitTenantQuery(orgId, projectId),
      startTimestamp: Math.floor((Date.now() - 86_400_000) / 1000),
      endTimestamp: Math.floor(Date.now() / 1000),
      maxHits: 0,
      aggregations: {
        latency: { percentiles: { field: 'duration', percents: [50, 95, 99] } },
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
    });
    const latency = result.aggregations?.latency as { values?: Record<string, number> } | undefined;
    const status = result.aggregations?.status as { buckets?: Array<{ key: string; doc_count: number }> } | undefined;
    const total = result.num_hits;
    return {
      totalRequests: total,
      errorRate: total ? Math.round(((status?.buckets ?? []).filter((b) => b.key === '4xx' || b.key === '5xx').reduce((n, b) => n + b.doc_count, 0) / total) * 10000) / 100 : 0,
      latencyP50: Math.round(latency?.values?.['50.0'] ?? 0),
      latencyP95: Math.round(latency?.values?.['95.0'] ?? 0),
      latencyP99: Math.round(latency?.values?.['99.0'] ?? 0),
      statusCodes: (status?.buckets ?? []).map((s) => ({ code: Number(s.key.slice(0, 3)), label: s.key, count: s.doc_count, percentage: total ? Math.round((s.doc_count / total) * 10000) / 100 : 0 })),
    };
  }

  async getTelemetryStatus(orgId: string, projectId: string) {
    return this.cached(`telemetry-status:${orgId}:${projectId}`, async () => {
      const result = await this.quickwit.search<{ timestamp?: string; service?: string; traceId?: string }>(
        QUICKWIT_INDEXES.requests,
        {
          query: quickwitTenantQuery(orgId, projectId),
          startTimestamp: Math.floor((Date.now() - 86_400_000) / 1000),
          endTimestamp: Math.floor(Date.now() / 1000),
          maxHits: 1,
          sortBy: ['timestamp:desc'],
        },
      );
      const latest = result.hits[0]?._source;
      const lastTelemetryAt = latest?.timestamp ?? null;
      const lastTelemetryAgeMs = lastTelemetryAt
        ? Math.max(0, Date.now() - new Date(lastTelemetryAt).getTime())
        : null;
      const keyStatus = lastTelemetryAt
        ? lastTelemetryAgeMs !== null && lastTelemetryAgeMs <= 300_000
          ? 'healthy'
          : 'stale'
        : 'waiting';

      return {
        status: keyStatus,
        hasTelemetry: result.num_hits > 0,
        lastTelemetryAt,
        lastTelemetryAgeMs,
        lastService: latest?.service ?? null,
        lastTraceId: latest?.traceId ?? null,
      };
    });
  }

  async getServices(orgId: string, projectId: string) {
    return this.cached(`services:${orgId}:${projectId}`, async () => {
      const result = await this.quickwit.search(QUICKWIT_INDEXES.requests, {
        query: quickwitTenantQuery(orgId, projectId),
        startTimestamp: Math.floor((Date.now() - 86_400_000) / 1000),
        endTimestamp: Math.floor(Date.now() / 1000),
        maxHits: 0,
        aggregations: {
          services: {
            terms: { field: 'service', size: 100, order: { _count: 'desc' } },
            aggs: { latency: { stats: { field: 'duration' } } },
          },
        },
      });
      const buckets = (result.aggregations?.services as { buckets?: Array<{ key: string; doc_count: number; latency?: { avg?: number } }> } | undefined)?.buckets ?? [];
      return buckets.map((bucket) => ({
        service: bucket.key,
        requestCount: bucket.doc_count,
        errorCount: 0,
        avgLatency: Math.round(bucket.latency?.avg ?? 0),
      }));
    });
  }

  async getErrors(orgId: string, projectId: string, limit = 50) {
    return this.cached(`errors:${orgId}:${projectId}:${limit}`, async () => {
      const result = await this.quickwit.search(QUICKWIT_INDEXES.logs, {
        query: quickwitTenantQuery(orgId, projectId, 'level:error'),
        startTimestamp: Math.floor((Date.now() - 86_400_000) / 1000),
        endTimestamp: Math.floor(Date.now() / 1000),
        maxHits: limit,
        sortBy: ['timestamp:desc'],
      });
      return result.hits.flatMap((hit) => {
        const source = hit._source as Record<string, unknown> | undefined;
        if (!source) return [];
        return [{
          fingerprint: String(source.fingerprint ?? source.traceId ?? source.message ?? ''),
          errorMessage: String(source.message ?? ''),
          errorType: String(source.errorType ?? 'Error'),
          service: String(source.service ?? ''),
          count: 1,
          lastSeen: String(source.timestamp ?? ''),
        }];
      });
    });
  }
}
