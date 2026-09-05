import { Injectable } from '@nestjs/common';
import { ClickhouseService } from '../../../common/clickhouse';

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

@Injectable()
export class MetricsRepository {
  constructor(private readonly clickhouse: ClickhouseService) {}

  async queryMetrics(params: {
    orgId: string;
    projectId: string;
    from: string;
    to: string;
    interval: string;
    service: string;
  }): Promise<MetricsBucket[]> {
    const intervalMap: Record<string, string> = {
      '1m': '1 MINUTE',
      '5m': '5 MINUTE',
      '1h': '1 HOUR',
      '1d': '1 DAY',
    };
    const interval = intervalMap[params.interval] || '5 MINUTE';
    const serviceFilter = params.service ? `AND service = {service:String}` : '';

    const query = `
      SELECT
        toString(toStartOfInterval(timestamp, INTERVAL ${interval})) AS bucket,
        count() AS count,
        quantile(0.5)(duration) AS p50,
        quantile(0.95)(duration) AS p95,
        quantile(0.99)(duration) AS p99,
        countIf(statusCode >= 200 AND statusCode < 300) AS _2xx,
        countIf(statusCode >= 300 AND statusCode < 400) AS _3xx,
        countIf(statusCode >= 400 AND statusCode < 500) AS _4xx,
        countIf(statusCode >= 500) AS _5xx
      FROM requests
      WHERE org_id = {orgId:String} AND project_id = {projectId:String}
        AND timestamp BETWEEN {from:DateTime64(3)} AND {to:DateTime64(3)}
        ${serviceFilter}
      GROUP BY bucket
      ORDER BY bucket
    `;

    return this.clickhouse.query<MetricsBucket>(query, {
      orgId: params.orgId,
      projectId: params.projectId,
      from: params.from,
      to: params.to,
      ...(params.service ? { service: params.service } : {}),
    });
  }
}
