import { Injectable } from '@nestjs/common';
import { TracesRepository, TraceRow } from './traces.repository';
import { GetTracesInput } from './dto';
import { chRange } from '../../../common/clickhouse/ch-time';

export interface TraceSpan extends TraceRow {
  children: TraceSpan[];
}

@Injectable()
export class TracesService {
  constructor(private readonly tracesRepository: TracesRepository) {}

  async listTraces(orgId: string, input: GetTracesInput) {
    const { from, to } = chRange(input.from, input.to);

    let cursor: { ts: string; traceId: string } | undefined;
    if (input.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(input.cursor, 'base64').toString('utf-8'));
        cursor = { ts: decoded.ts, traceId: decoded.traceId };
      } catch {
        cursor = undefined;
      }
    }

    const rows = await this.tracesRepository.listTraces({
      orgId,
      projectId: input.projectId,
      from,
      to,
      limit: input.limit,
      cursor,
      q: input.q,
      service: input.service,
    });

    let nextCursor: string | undefined;
    if (rows.length === input.limit && rows.length > 0) {
      const last = rows[rows.length - 1]!;
      nextCursor = Buffer.from(JSON.stringify({ ts: last.start, traceId: last.traceId })).toString('base64');
    }

    return { data: rows, nextCursor };
  }

  async getTrace(orgId: string, projectId: string, traceId: string) {
    const spans = await this.tracesRepository.getTraceSpans({ orgId, projectId, traceId });
    const tree = this.buildTree(spans);
    return { traceId, spans, tree };
  }

  private buildTree(spans: TraceRow[]): TraceSpan[] {
    const map = new Map<string, TraceSpan>();
    const roots: TraceSpan[] = [];

    for (const s of spans) {
      map.set(s.spanId, { ...s, children: [] });
    }

    for (const s of spans) {
      const node = map.get(s.spanId)!;
      if (s.parentSpanId && map.has(s.parentSpanId)) {
        map.get(s.parentSpanId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sort = (nodes: TraceSpan[]) => {
      nodes.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      for (const n of nodes) sort(n.children);
    };
    sort(roots);
    return roots;
  }
}
