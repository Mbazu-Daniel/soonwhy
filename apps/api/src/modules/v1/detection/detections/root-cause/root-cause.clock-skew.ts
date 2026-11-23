import { MAX_ESCAPED_RATIO } from "./root-cause.constants";
import type { TraceSpan } from "./root-cause.ranker.types";
import type { ClockSkewCorrection } from "./root-cause.clock-skew.types";
import { measureTraceIntegrity } from "./root-cause.trace-integrity";

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

function edgeOffsets(traces: TraceSpan[][]): Map<string, Map<string, number[]>> {
  const edges = new Map<string, Map<string, number[]>>();
  for (const trace of traces) {
    const byId = new Map(trace.map((span) => [span.spanId, span]));
    for (const child of trace) {
      const parent = child.parentSpanId === undefined ? undefined : byId.get(child.parentSpanId);
      if (!parent || parent.serviceName === child.serviceName) continue;
      const lower = child.startTime + child.duration - (parent.startTime + parent.duration);
      const upper = child.startTime - parent.startTime;
      const toChildren = edges.get(parent.serviceName) ?? new Map<string, number[]>();
      toChildren.set(child.serviceName, [...(toChildren.get(child.serviceName) ?? []), (lower + upper) / 2]);
      edges.set(parent.serviceName, toChildren);
    }
  }
  return edges;
}

function rootService(traces: TraceSpan[][]): string | undefined {
  const counts = new Map<string, number>();
  for (const span of traces.flat()) if (span.parentSpanId === undefined) counts.set(span.serviceName, (counts.get(span.serviceName) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

function solveOffsets(traces: TraceSpan[][], root: string): Map<string, number> {
  const neighbours = new Map<string, Array<[string, number]>>();
  for (const [from, toChildren] of edgeOffsets(traces)) {
    for (const [to, estimates] of toChildren) {
      const delta = median(estimates);
      neighbours.set(from, [...(neighbours.get(from) ?? []), [to, delta]]);
      neighbours.set(to, [...(neighbours.get(to) ?? []), [from, -delta]]);
    }
  }
  const offsets = new Map<string, number>([[root, 0]]);
  const queue = [root];
  for (let head = 0; head < queue.length; head++) {
    const service = queue[head]!;
    for (const [next, delta] of neighbours.get(service) ?? []) {
      if (offsets.has(next)) continue;
      offsets.set(next, offsets.get(service)! + delta);
      queue.push(next);
    }
  }
  return offsets;
}

export function correctClockSkew(traces: TraceSpan[][]): ClockSkewCorrection {
  const none = { traces, offsets: new Map<string, number>() };
  if (measureTraceIntegrity(traces).escapedRatio <= MAX_ESCAPED_RATIO) return none;
  const root = rootService(traces);
  if (root === undefined) return none;
  const offsets = solveOffsets(traces, root);
  return {
    traces: traces.map((trace) => trace.map((span) => ({ ...span, startTime: span.startTime - (offsets.get(span.serviceName) ?? 0) }))),
    offsets,
  };
}
