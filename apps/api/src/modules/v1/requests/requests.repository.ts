import { Injectable } from '@nestjs/common';
import { ClickhouseService } from '../../../common/clickhouse';

export interface RequestStat {
  url: string;
  method: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
}

@Injectable()
export class RequestsRepository {
  constructor(private readonly clickhouse: ClickhouseService) {}

  async queryStats(params: { orgId: string; projectId: string; from: string; to: string }): Promise<RequestStat[]> {
    const query = `
      SELECT
        url,
        method,
        count() AS count,
        quantile(0.5)(duration) AS p50,
        quantile(0.95)(duration) AS p95,
        quantile(0.99)(duration) AS p99,
        countIf(statusCode >= 400) / count() * 100 AS errorRate
      FROM requests
      WHERE org_id = {orgId:String} AND project_id = {projectId:String}
        AND timestamp BETWEEN {from:DateTime64(3)} AND {to:DateTime64(3)}
      GROUP BY url, method
      ORDER BY count DESC
      LIMIT 50
    `;
    return this.clickhouse.query<RequestStat>(query, {
      orgId: params.orgId,
      projectId: params.projectId,
      from: params.from,
      to: params.to,
    });
  }
}
