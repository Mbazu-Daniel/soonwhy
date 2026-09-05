import { Injectable } from '@nestjs/common';
import { ClickhouseService } from '../../../common/clickhouse';

export interface TraceRow {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  name: string;
  duration: number;
  timestamp: string;
  service: string;
}

export interface TraceListRow {
  traceId: string;
  name: string;
  start: string;
  end: string;
  spanCount: number;
}

@Injectable()
export class TracesRepository {
  constructor(private readonly clickhouse: ClickhouseService) {}

  async listTraces(params: { orgId: string; projectId: string; from: string; to: string; limit: number; cursor?: { ts: string; traceId: string } }): Promise<TraceListRow[]> {
    const cursorFilter = params.cursor ? `AND (minTimestamp, traceId) < ({cursorTs:DateTime64(3)}, {cursorTraceId:String})` : '';
    const query = `
      SELECT
        traceId,
        any(name) AS name,
        toString(min(timestamp)) AS start,
        toString(max(timestamp)) AS end,
        count() AS spanCount,
        min(timestamp) AS minTimestamp
      FROM traces
      WHERE org_id = {orgId:String} AND project_id = {projectId:String}
        AND timestamp BETWEEN {from:DateTime64(3)} AND {to:DateTime64(3)}
        ${cursorFilter}
      GROUP BY traceId
      ORDER BY minTimestamp DESC
      LIMIT {limit:UInt32}
    `;
    return this.clickhouse.query<TraceListRow>(query, {
      orgId: params.orgId,
      projectId: params.projectId,
      from: params.from,
      to: params.to,
      limit: params.limit,
      ...(params.cursor ? { cursorTs: params.cursor.ts, cursorTraceId: params.cursor.traceId } : {}),
    });
  }

  async getTraceSpans(params: { orgId: string; projectId: string; traceId: string }): Promise<TraceRow[]> {
    const query = `
      SELECT traceId, spanId, parentSpanId, name, duration, toString(timestamp) as timestamp, service
      FROM traces
      WHERE org_id = {orgId:String} AND project_id = {projectId:String} AND traceId = {traceId:String}
      ORDER BY timestamp ASC
    `;
    return this.clickhouse.query<TraceRow>(query, {
      orgId: params.orgId,
      projectId: params.projectId,
      traceId: params.traceId,
    });
  }
}
