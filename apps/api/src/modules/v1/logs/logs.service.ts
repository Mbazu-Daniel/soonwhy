import { Injectable } from '@nestjs/common';
import { LogsRepository } from './logs.repository';
import { GetLogsInput } from './dto';
import { chRange } from '../../../common/clickhouse/ch-time';

@Injectable()
export class LogsService {
  constructor(private readonly logsRepository: LogsRepository) {}

  async getLogs(orgId: string, projectId: string, input: GetLogsInput) {
    const { from, to } = chRange(input.from, input.to);

    let cursor: { ts: string; id: string } | undefined;
    if (input.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(input.cursor, 'base64').toString('utf-8'));
        cursor = { ts: decoded.ts, id: decoded.id };
      } catch {
        cursor = undefined;
      }
    }

    const limit = input.limit ?? 50;
    const rows = await this.logsRepository.queryLogs({
      orgId,
      projectId,
      from,
      to,
      level: input.level || 'all',
      service: input.service || '',
      q: input.q || '',
      limit,
      cursor,
    });

    const data = rows.map((r) => {
      let attributes: Record<string, unknown> = {};
      try {
        attributes = JSON.parse(r.attributes || '{}');
      } catch {
        attributes = {};
      }
      return {
        id: r.id,
        timestamp: r.timestamp,
        level: r.level,
        service: r.service,
        message: r.message,
        attributes,
      };
    });

    let nextCursor: string | undefined;
    if (rows.length === limit && rows.length > 0) {
      const last = rows[rows.length - 1]!;
      nextCursor = Buffer.from(
        JSON.stringify({ ts: last.timestamp, id: last.id }),
      ).toString('base64');
    }

    return { data, nextCursor };
  }
}