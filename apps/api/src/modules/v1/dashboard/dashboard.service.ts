import { Injectable } from "@nestjs/common";
import { QUICKWIT_INDEXES, QuickwitService } from "@soonwhy/shared";
import { quickwitSource, quickwitTenantQuery } from "../../../common/quickwit/query";
import { CacheService } from "../../../common/cache/cache.service";
import { CACHE_TTL_SECONDS } from "../../../common/cache/cache.constants";
import { MetricsRepository } from "../metrics/metrics.repository";
import { healthScore, summarize, summaryInterval } from "../metrics/request-summary";
import type { StatusCounts } from "../metrics/request-summary.types";

@Injectable()
export class DashboardService {
  constructor(
    private readonly quickwit: QuickwitService,
    private readonly cache: CacheService,
    private readonly metrics: MetricsRepository,
  ) {}

  private range(from?: string, to?: string) {
    const end = to ? new Date(to).getTime() : Date.now();
    const start = from ? new Date(from).getTime() : end - 86_400_000;
    return {
      start,
      end,
      from: new Date(start).toISOString(),
      to: new Date(end).toISOString(),
    };
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    return this.cache.getOrSet(key, CACHE_TTL_SECONDS.dashboardOverview, load);
  }

  async getOverview(
    orgId: string,
    projectId: string,
    from?: string,
    to?: string,
  ) {
    const range = this.range(from, to);
    const cacheKey = `overview:${orgId}:${projectId}:${range.start}:${range.end}`;
    return this.cached(cacheKey, async () => {
      const [raw, buckets] = await Promise.all([
        this.metrics.querySummary({ orgId, projectId, from: range.from, to: range.to }),
        this.metrics.queryMetrics({
          orgId,
          projectId,
          from: range.from,
          to: range.to,
          interval: summaryInterval(range.end - range.start),
          service: "",
        }),
      ]);
      const summary = summarize(raw);
      const seconds = Math.max(1, (range.end - range.start) / 1000);
      const peak = Math.max(...buckets.map((bucket) => bucket.count), 1);
      return {
        score: healthScore(summary),
        ...summary,
        requestRate: Math.round((summary.totalRequests / seconds) * 10000) / 10000,
        statusCodes: this.statusList(summary.statusCodes, summary.totalRequests),
        timeSeries: buckets.map((bucket) => ({
          timestamp: new Date(bucket.bucket).getTime(),
          count: bucket.count,
          normalizedHeight: (bucket.count / peak) * 100,
        })),
        from: range.from,
        to: range.to,
      };
    });
  }

  private statusList(status: StatusCounts, total: number) {
    return (["2xx", "3xx", "4xx", "5xx"] as const)
      .map((label) => ({
        code: Number(label[0]) * 100,
        label,
        count: status[`_${label}`],
        percentage: total ? Math.round((status[`_${label}`] / total) * 10000) / 100 : 0,
      }))
      .filter((entry) => entry.count > 0);
  }

  async getTelemetryStatus(orgId: string, projectId: string) {
    return this.cached(`telemetry-status:${orgId}:${projectId}`, async () => {
      const result = await this.quickwit.search<{
        timestamp?: string;
        service?: string;
        traceId?: string;
      }>(QUICKWIT_INDEXES.logs, {
        query: quickwitTenantQuery(orgId, projectId),
        startTimestamp: Math.floor((Date.now() - 86_400_000) / 1000),
        endTimestamp: Math.floor(Date.now() / 1000),
        maxHits: 1,
        sortBy: ["timestamp:desc"],
      });
      const latest = quickwitSource<Record<string, any>>(result.hits[0]);
      const lastTelemetryAt = latest?.timestamp ?? null;
      const lastTelemetryAgeMs = lastTelemetryAt
        ? Math.max(0, Date.now() - new Date(lastTelemetryAt).getTime())
        : null;
      const status = lastTelemetryAt
        ? lastTelemetryAgeMs !== null && lastTelemetryAgeMs <= 300_000
          ? "healthy"
          : "stale"
        : "waiting";
      return {
        status,
        hasTelemetry: result.num_hits > 0,
        lastTelemetryAt,
        lastTelemetryAgeMs,
        lastService: latest?.service ?? null,
        lastTraceId: latest?.traceId ?? null,
      };
    });
  }

  async getServices(
    orgId: string,
    projectId: string,
    from?: string,
    to?: string,
  ) {
    const range = this.range(from, to);
    const cacheKey = `services:${orgId}:${projectId}:${range.start}:${range.end}`;
    return this.cached(cacheKey, async () => {
      const services = await this.metrics.queryServiceSummaries({
        orgId,
        projectId,
        from: range.from,
        to: range.to,
      });
      return services.sort((a, b) => b.requestCount - a.requestCount);
    });
  }
}
