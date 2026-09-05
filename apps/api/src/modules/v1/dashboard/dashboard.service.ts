import { Injectable, Logger } from '@nestjs/common';
import { ClickhouseService } from '../../../common/clickhouse';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private cache = new Map<string, { data: unknown; expires: number }>();
  private readonly CACHE_TTL = 30_000; // 30s

  constructor(private readonly clickhouse: ClickhouseService) {}

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
    const rows = await this.clickhouse.query<{ requests: number; errors: number; avgLatency: number }>(
      `SELECT
        countIf(table = 'requests') as requests,
        countIf(table = 'errors') as errors,
        (SELECT avg(duration) FROM requests WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR) as avgLatency
      FROM (
        SELECT 'requests' as table FROM requests WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR LIMIT 1
        UNION ALL
        SELECT 'errors' as table FROM errors WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR LIMIT 1
      )`,
      { orgId, projectId },
    );

    // Better approach: single query for counts
    const counts = await this.clickhouse.query<{ requestCount: number; errorCount: number }>(
      `SELECT
        (SELECT count() FROM requests WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR) as requestCount,
        (SELECT count() FROM errors WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR) as errorCount`,
      { orgId, projectId },
    );

    const requests = counts[0]?.requestCount ?? 0;
    const errors = counts[0]?.errorCount ?? 0;
    const avgLatency = rows[0]?.avgLatency ?? 0;

    if (requests === 0) return { score: 0, errorRate: 0, requestRate: 0, avgLatency: 0 };

    const errorRate = (errors / requests) * 100;
    const requestRate = requests / 86400;
    const score = Math.max(0, Math.min(100, Math.round(100 - errorRate * 10 - avgLatency / 100)));

    return { score, errorRate: Math.round(errorRate * 100) / 100, requestRate: Math.round(requestRate * 10) / 10, avgLatency: Math.round(avgLatency) };
  }

  private async getMetricsRaw(orgId: string, projectId: string) {
    // Single query hitting requests table once
    const rows = await this.clickhouse.query<{
      totalRequests: number;
      errorCount: number;
      latencyP50: number;
      latencyP95: number;
      latencyP99: number;
      status2xx: number;
      status3xx: number;
      status4xx: number;
      status5xx: number;
    }>(
      `SELECT
        count() as totalRequests,
        (SELECT count() FROM errors WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR) as errorCount,
        quantile(0.50)(duration) as latencyP50,
        quantile(0.95)(duration) as latencyP95,
        quantile(0.99)(duration) as latencyP99,
        countIf(statusCode >= 200 AND statusCode < 300) as status2xx,
        countIf(statusCode >= 300 AND statusCode < 400) as status3xx,
        countIf(statusCode >= 400 AND statusCode < 500) as status4xx,
        countIf(statusCode >= 500) as status5xx
      FROM requests
      WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR`,
      { orgId, projectId },
    );

    const r = rows[0];
    const total = r?.totalRequests ?? 0;

    return {
      totalRequests: total,
      errorRate: total > 0 ? Math.round(((r?.errorCount ?? 0) / total) * 10000) / 100 : 0,
      latencyP50: Math.round(r?.latencyP50 ?? 0),
      latencyP95: Math.round(r?.latencyP95 ?? 0),
      latencyP99: Math.round(r?.latencyP99 ?? 0),
      statusCodes: [
        { code: 200, label: '2xx', count: r?.status2xx ?? 0 },
        { code: 300, label: '3xx', count: r?.status3xx ?? 0 },
        { code: 400, label: '4xx', count: r?.status4xx ?? 0 },
        { code: 500, label: '5xx', count: r?.status5xx ?? 0 },
      ].map((s) => ({ ...s, percentage: total > 0 ? Math.round((s.count / total) * 10000) / 100 : 0 })),
    };
  }

  async getServices(orgId: string, projectId: string) {
    const cacheKey = `services:${orgId}:${projectId}`;
    return this.cached(cacheKey, async () => {
      // Two queries instead of N+1: one for requests, one for errors, join in JS
      const [requestStats, errorStats] = await Promise.all([
        this.clickhouse.query<{ service: string; requestCount: number; avgLatency: number }>(
          `SELECT service, count() as requestCount, avg(duration) as avgLatency
          FROM requests
          WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR
          GROUP BY service ORDER BY requestCount DESC`,
          { orgId, projectId },
        ),
        this.clickhouse.query<{ service: string; errorCount: number }>(
          `SELECT service, count() as errorCount
          FROM errors
          WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR
          GROUP BY service`,
          { orgId, projectId },
        ),
      ]);

      const errorMap = new Map(errorStats.map((e) => [e.service, e.errorCount]));
      return requestStats.map((r) => ({
        service: r.service,
        requestCount: r.requestCount,
        errorCount: errorMap.get(r.service) ?? 0,
        avgLatency: Math.round(r.avgLatency),
      }));
    });
  }

  async getErrors(orgId: string, projectId: string, limit = 50) {
    const cacheKey = `errors:${orgId}:${projectId}:${limit}`;
    return this.cached(cacheKey, () =>
      this.clickhouse.query<{ fingerprint: string; errorMessage: string; errorType: string; service: string; count: number; lastSeen: string }>(
        `SELECT
          fingerprint,
          any(errorMessage) as errorMessage,
          any(errorType) as errorType,
          any(service) as service,
          count() as count,
          max(timestamp) as lastSeen
        FROM errors
        WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR
        GROUP BY fingerprint
        ORDER BY count DESC
        LIMIT {limit:UInt32}`,
        { orgId, projectId, limit },
      ),
    );
  }
}
