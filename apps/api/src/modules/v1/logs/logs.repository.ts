import { Injectable } from '@nestjs/common';
import { ClickhouseService } from '../../../common/clickhouse';

export interface RawLogRow {
  id: string;
  timestamp: string;
  level: string;
  service: string;
  message: string;
  attributes: string;
}

@Injectable()
export class LogsRepository {
  constructor(private readonly clickhouse: ClickhouseService) {}

  async queryLogs(params: {
    orgId: string;
    projectId: string;
    from: string;
    to: string;
    level: string;
    service: string;
    q: string;
    limit: number;
    cursor?: { ts: string; id: string };
  }): Promise<RawLogRow[]> {
    const { orgId, projectId, from, to, level, service, q, limit, cursor } = params;

    const levelFilter = level && level !== 'all' ? `AND level = {level:String}` : '';
    const serviceFilter = service ? `AND service = {service:String}` : '';
    const qFilter = q ? `AND message ILIKE {q:String}` : '';
    const cursorFilter = cursor ? `AND (timestamp, id) < ({cursorTs:DateTime64(3)}, {cursorId:String})` : '';

    const query = `
      SELECT id, toString(timestamp) as timestamp, level, service, message, attributes
      FROM logs
      WHERE org_id = {orgId:String} AND project_id = {projectId:String}
        AND timestamp BETWEEN {from:DateTime64(3)} AND {to:DateTime64(3)}
        ${levelFilter}
        ${serviceFilter}
        ${qFilter}
        ${cursorFilter}
      ORDER BY timestamp DESC, id DESC
      LIMIT {limit:UInt32}
    `;

    const queryParams: Record<string, unknown> = {
      orgId,
      projectId,
      from,
      to,
      limit,
      ...(level && level !== 'all' ? { level } : {}),
      ...(service ? { service } : {}),
      ...(q ? { q: `%${q}%` } : {}),
      ...(cursor ? { cursorTs: cursor.ts, cursorId: cursor.id } : {}),
    };

    return this.clickhouse.query<RawLogRow>(query, queryParams);
  }
}
