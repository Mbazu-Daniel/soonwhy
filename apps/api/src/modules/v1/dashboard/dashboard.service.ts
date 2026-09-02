import { Injectable, Logger } from '@nestjs/common';
import { ClickhouseService } from '../../../clickhouse';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  constructor(private readonly clickhouse: ClickhouseService) {}

  async getHealthScore(orgId: string, projectId: string) {
    const [errorCount, requestCount, avgLatency] = await Promise.all([
      this.clickhouse.query<{ count: number }>(
        `SELECT count() as count FROM errors WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR`,
        { orgId, projectId },
      ),
      this.clickhouse.query<{ count: number }>(
        `SELECT count() as count FROM requests WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR`,
        { orgId, projectId },
      ),
      this.clickhouse.query<{ avg: number }>(
        `SELECT avg(duration) as avg FROM requests WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR`,
        { orgId, projectId },
      ),
    ]);

    const errors = errorCount[0]?.count ?? 0;
    const requests = requestCount[0]?.count ?? 0;
    const latency = avgLatency[0]?.avg ?? 0;

    if (requests === 0) return { score: 0, errorRate: 0, requestRate: 0, avgLatency: 0 };

    const errorRate = (errors / requests) * 100;
    const requestRate = requests / 86400; // per second over 24h

    // Score: 100 - (errorRate * 10) - (latency / 100), clamped 0-100
    const score = Math.max(0, Math.min(100, Math.round(100 - errorRate * 10 - latency / 100)));

    return { score, errorRate: Math.round(errorRate * 100) / 100, requestRate: Math.round(requestRate * 10) / 10, avgLatency: Math.round(latency) };
  }

  async getMetrics(orgId: string, projectId: string) {
    const [totalRequests, errorCount, latencyP50, latencyP95, latencyP99, statusCodes] = await Promise.all([
      this.clickhouse.query<{ count: number }>(
        `SELECT count() as count FROM requests WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR`,
        { orgId, projectId },
      ),
      this.clickhouse.query<{ count: number }>(
        `SELECT count() as count FROM errors WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR`,
        { orgId, projectId },
      ),
      this.clickhouse.query<{ value: number }>(
        `SELECT quantile(0.50)(duration) as value FROM requests WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR`,
        { orgId, projectId },
      ),
      this.clickhouse.query<{ value: number }>(
        `SELECT quantile(0.95)(duration) as value FROM requests WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR`,
        { orgId, projectId },
      ),
      this.clickhouse.query<{ value: number }>(
        `SELECT quantile(0.99)(duration) as value FROM requests WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR`,
        { orgId, projectId },
      ),
      this.clickhouse.query<{ status: number; count: number }>(
        `SELECT statusCode as status, count() as count FROM requests WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR GROUP BY statusCode ORDER BY count DESC`,
        { orgId, projectId },
      ),
    ]);

    const total = totalRequests[0]?.count ?? 0;
    const errors = errorCount[0]?.count ?? 0;

    return {
      totalRequests: total,
      errorRate: total > 0 ? Math.round((errors / total) * 10000) / 100 : 0,
      latencyP50: Math.round(latencyP50[0]?.value ?? 0),
      latencyP95: Math.round(latencyP95[0]?.value ?? 0),
      latencyP99: Math.round(latencyP99[0]?.value ?? 0),
      statusCodes: statusCodes.map((r) => ({
        code: r.status,
        count: r.count,
        percentage: total > 0 ? Math.round((r.count / total) * 10000) / 100 : 0,
      })),
    };
  }

  async getServices(orgId: string, projectId: string) {
    return this.clickhouse.query<{ service: string; requestCount: number; errorCount: number; avgLatency: number }>(
      `SELECT
        service,
        countIf(timestamp >= now() - INTERVAL 24 HOUR) as requestCount,
        (SELECT count() FROM errors e WHERE e.org_id = {orgId:String} AND e.project_id = {projectId:String} AND e.service = r.service AND e.timestamp >= now() - INTERVAL 24 HOUR) as errorCount,
        avg(duration) as avgLatency
      FROM requests r
      WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND timestamp >= now() - INTERVAL 24 HOUR
      GROUP BY service
      ORDER BY requestCount DESC`,
      { orgId, projectId },
    );
  }

  async getErrors(orgId: string, projectId: string, limit = 50) {
    return this.clickhouse.query<{ fingerprint: string; errorMessage: string; errorType: string; service: string; count: number; lastSeen: string }>(
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
    );
  }

  async getLogs(orgId: string, projectId: string, limit = 100, level?: string) {
    const levelFilter = level && level !== 'all' ? `AND level = {level:String}` : '';
    return this.clickhouse.query<{ id: string; timestamp: string; level: string; service: string; message: string; attributes: string }>(
      `SELECT id, toString(timestamp) as timestamp, level, service, message, attributes
      FROM logs
      WHERE org_id = {orgId:String} AND project_id = {projectId:String} ${levelFilter}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32}`,
      { orgId, projectId, limit, ...(level ? { level } : {}) },
    );
  }
}
