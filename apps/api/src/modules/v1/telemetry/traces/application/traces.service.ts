import { Injectable } from "@nestjs/common";
import { TracesRepository } from "../infrastructure/traces.repository";
import { TraceRow, type TraceScope } from "../domain/traces.repository.types";
import { GetTraceStatsInput, GetTracesInput } from "../domain/dto";
import { decodeOffset, nextOffsetCursor } from "../domain/trace-cursor";
import { analyzeTracePayloads } from "../domain/trace-payloads";
import { analyzeTraceQueries } from "../domain/trace-queries";
import { traceExtents } from "../domain/trace-extent";
import type { QuerySpan } from "../domain/trace-queries.types";
import type { TraceSpan } from "../domain/traces.service.types";

@Injectable()
export class TracesService {
  constructor(private readonly tracesRepository: TracesRepository) {}

  private scopeOf(orgId: string, input: GetTraceStatsInput): TraceScope {
    return {
      orgId,
      projectId: input.projectId,
      from: input.from ?? new Date(0).toISOString(),
      to: input.to ?? new Date().toISOString(),
      q: input.q,
      traceIds: input.traceIds,
      service: input.service,
      operation: input.operation,
      status: input.status,
      minDuration: input.minDuration,
      maxDuration: input.maxDuration,
    };
  }

  async listTraces(orgId: string, input: GetTracesInput) {
    const offset = decodeOffset(input.cursor);
    const rows = await this.tracesRepository.listTraces({
      ...this.scopeOf(orgId, input),
      limit: input.limit,
      offset,
    });
    return { data: rows, nextCursor: nextOffsetCursor(offset, rows.length, input.limit) };
  }

  getStats(orgId: string, input: GetTraceStatsInput) {
    return this.tracesRepository.traceStats(this.scopeOf(orgId, input));
  }

  async getSpanLogCounts(orgId: string, projectId: string, traceId: string) {
    return { counts: await this.tracesRepository.spanLogCounts({ orgId, projectId, traceId }) };
  }

  async getTrace(orgId: string, projectId: string, traceId: string) {
    const spans = await this.tracesRepository.getTraceSpans({
      orgId,
      projectId,
      traceId,
    });
    return {
      traceId,
      spans,
      tree: this.buildTree(spans),
      queries: analyzeTraceQueries(spans as QuerySpan[], traceExtents(spans).get(traceId) ?? 0),
      payloads: analyzeTracePayloads(spans),
    };
  }

  private buildTree(spans: TraceRow[]): TraceSpan[] {
    const map = new Map<string, TraceSpan>();
    const roots: TraceSpan[] = [];
    for (const s of spans) map.set(s.spanId, { ...s, children: [] });
    for (const s of spans) {
      const node = map.get(s.spanId)!;
      if (s.parentSpanId && map.has(s.parentSpanId))
        map.get(s.parentSpanId)!.children.push(node);
      else roots.push(node);
    }
    const sort = (nodes: TraceSpan[]) => {
      nodes.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      for (const n of nodes) sort(n.children);
    };
    sort(roots);
    return roots;
  }
}
