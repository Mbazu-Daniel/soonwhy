import { Injectable } from "@nestjs/common";
import { QUICKWIT_INDEXES, QuickwitService } from "@soonwhy/shared";
import { quickwitTenantQuery } from "../../../common/quickwit/query";

@Injectable()
export class DashboardService {
  private cache = new Map<string, { data: unknown; expires: number }>();
  private readonly CACHE_TTL = 30_000;

  constructor(private readonly quickwit: QuickwitService) {}

  private range(from?: string, to?: string) {
    const end = to ? new Date(to).getTime() : Date.now();
    const start = from ? new Date(from).getTime() : end - 86_400_000;
    return {
      startTimestamp: Math.floor(start / 1000),
      endTimestamp: Math.floor(end / 1000),
      start,
      end,
    };
  }

  private async cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.cache.get(key);
    if (hit && hit.expires > now) return hit.data as T;
    const data = await fn();
    this.cache.set(key, { data, expires: now + this.CACHE_TTL });
    return data;
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
      const [health, metrics] = await Promise.all([
        this.getHealthScoreRaw(orgId, projectId, range),
        this.getMetricsRaw(orgId, projectId, range),
      ]);
      return {
        ...health,
        ...metrics,
        from: new Date(range.start).toISOString(),
        to: new Date(range.end).toISOString(),
      };
    });
  }

  private async fetchLogs(
    orgId: string,
    projectId: string,
    range: {
      startTimestamp: number;
      endTimestamp: number;
    },
    maxHits = 10_000,
  ) {
    const result = await this.quickwit.search<Record<string, unknown>>(
      QUICKWIT_INDEXES.logs,
      {
        query: quickwitTenantQuery(orgId, projectId),
        startTimestamp: range.startTimestamp,
        endTimestamp: range.endTimestamp,
        maxHits,
        sortBy: ["-timestamp"],
      },
    );
    return result.hits.map((h) => h._source ?? {}).filter(Boolean);
  }

  private static num(v: unknown): number | null {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private static percentile(sorted: number[], p: number): number {
    if (!sorted.length) return 0;
    const rank = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    if (lower === upper) return sorted[lower]!;
    const frac = rank - lower;
    return sorted[lower]! * (1 - frac) + sorted[upper]!;
  }

  private async getHealthScoreRaw(
    orgId: string,
    projectId: string,
    range: {
      startTimestamp: number;
      endTimestamp: number;
      start: number;
      end: number;
    },
  ) {
    const logs = await this.fetchLogs(orgId, projectId, range);
    const total = logs.length;
    const durations: number[] = [];
    let errors = 0;
    for (const log of logs) {
      const d = DashboardService.num(log["http.duration_ms"]);
      if (d != null) durations.push(d);
      const s = DashboardService.num(log["http.status_code"]);
      if (s != null && s >= 400) errors += 1;
    }
    durations.sort((a, b) => a - b);
    const p95 = DashboardService.percentile(durations, 95);
    const errorRate = total ? (errors / total) * 100 : 0;
    const durationSeconds = Math.max(1, (range.end - range.start) / 1000);
    return {
      score: total
        ? Math.max(
            0,
            Math.min(100, Math.round(100 - errorRate * 10 - p95 / 100)),
          )
        : 0,
      errorRate: Math.round(errorRate * 100) / 100,
      requestRate: Math.round((total / durationSeconds) * 10) / 10,
      avgLatency: Math.round(p95),
    };
  }

  private async getMetricsRaw(
    orgId: string,
    projectId: string,
    range: { startTimestamp: number; endTimestamp: number },
  ) {
    const logs = await this.fetchLogs(orgId, projectId, range);
    const total = logs.length;
    const durations: number[] = [];
    const statusBuckets: Record<string, number> = {};
    let errors = 0;
    for (const log of logs) {
      const d = DashboardService.num(log["http.duration_ms"]);
      if (d != null) durations.push(d);
      const s = DashboardService.num(log["http.status_code"]);
      if (s != null) {
        const key = Math.floor(s / 100) + "xx";
        statusBuckets[key] = (statusBuckets[key] ?? 0) + 1;
        if (s >= 400) errors += 1;
      }
    }
    durations.sort((a, b) => a - b);
    const p50 = DashboardService.percentile(durations, 50);
    const p95 = DashboardService.percentile(durations, 95);
    const p99 = DashboardService.percentile(durations, 99);
    const errorRate = total ? (errors / total) * 100 : 0;
    return {
      totalRequests: total,
      errorRate: Math.round(errorRate * 100) / 100,
      latencyP50: Math.round(p50),
      latencyP95: Math.round(p95),
      latencyP99: Math.round(p99),
      statusCodes: Object.entries(statusBuckets).map(([label, count]) => ({
        code: Number(label.slice(0, 3)),
        label,
        count,
        percentage: total ? Math.round((count / total) * 10000) / 100 : 0,
      })),
    };
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
        sortBy: ["-timestamp"],
      });
      const latest = result.hits[0]?._source;
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
      const logs = await this.fetchLogs(orgId, projectId, range);
      const byService = new Map<string, {
        count: number;
        errors: number;
        durations: number[];
      }>();
      for (const log of logs) {
        const service = String(log.service ?? "unknown");
        const entry = byService.get(service) ?? { count: 0, errors: 0, durations: [] };
        entry.count += 1;
        const s = DashboardService.num(log["http.status_code"]);
        if (s != null && s >= 400) entry.errors += 1;
        const d = DashboardService.num(log["http.duration_ms"]);
        if (d != null) entry.durations.push(d);
        byService.set(service, entry);
      }
      const buckets = Array.from(byService.entries()).
        sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 100);
      return buckets.map(([service, entry]) => {
        entry.durations.sort((a, b) => a - b);
        const p95 = DashboardService.percentile(entry.durations, 95);
        return {
          service,
          requestCount: entry.count,
          errorCount: entry.errors,
          errorRate: entry.count ? Math.round((entry.errors / entry.count) * 10000) / 100 : 0,
          p95Latency: Math.round(p95),
        };
      });
    });
  }

  async getErrors(
    orgId: string,
    projectId: string,
    limit = 50,
    from?: string,
    to?: string,
    service?: string,
  ) {
    const range = this.range(from, to);
    const cacheKey = `errors:${orgId}:${projectId}:${limit}:${range.start}:${range.end}:${service ?? ""}`;
    return this.cached(cacheKey, async () => {
      const tenantQuery = quickwitTenantQuery(orgId, projectId);
      const query = [
        tenantQuery,
        "level:error",
        service ? `service:\"${service.replace(/\"/g, '\\\"')}\"` : "",
      ]
        .filter(Boolean)
        .join(" AND ");
      const result = await this.quickwit.search(QUICKWIT_INDEXES.logs, {
        query,
        startTimestamp: range.startTimestamp,
        endTimestamp: range.endTimestamp,
        maxHits: Math.min(limit * 20, 1000),
        sortBy: ["-timestamp"],
      });
      const groups = new Map<
        string,
        {
          fingerprint: string;
          errorMessage: string;
          errorType: string;
          service: string;
          count: number;
          lastSeen: string;
        }
      >();
      for (const hit of result.hits) {
        const source = hit._source as Record<string, unknown> | undefined;
        if (!source) continue;
        const fingerprint = String(
          source.fingerprint ?? source.traceId ?? source.message ?? "",
        );
        const timestamp = String(source.timestamp ?? "");
        const key = fingerprint + "\\0" + String(source.service ?? "");
        const existing = groups.get(key);
        if (existing) {
          existing.count += 1;
          if (timestamp > existing.lastSeen) existing.lastSeen = timestamp;
        } else {
          groups.set(key, {
            fingerprint,
            errorMessage: String(source.message ?? ""),
            errorType: String(source.errorType ?? "Error"),
            service: String(source.service ?? ""),
            count: 1,
            lastSeen: timestamp,
          });
        }
      }
      return [...groups.values()]
        .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
        .slice(0, limit);
    });
  }
}
