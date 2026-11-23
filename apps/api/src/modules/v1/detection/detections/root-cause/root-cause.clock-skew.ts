import { MAX_ESCAPED_RATIO } from "./root-cause.constants";
import type { TraceSpan } from "./root-cause.ranker.types";
import type { ClockSkewCorrection } from "./root-cause.clock-skew.types";
import { measureTraceIntegrity } from "./root-cause.trace-integrity";

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

interface PairSamples {
  midpoints: number[];
  lower: number;
  upper: number;
}

function edgeSamples(traces: TraceSpan[][]): Map<string, Map<string, PairSamples>> {
  const edges = new Map<string, Map<string, PairSamples>>();
  for (const trace of traces) {
    const byId = new Map(trace.map((span) => [span.spanId, span]));
    for (const child of trace) {
      const parent = child.parentSpanId === undefined ? undefined : byId.get(child.parentSpanId);
      if (!parent || parent.serviceName === child.serviceName) continue;
      const lower = child.startTime + child.duration - (parent.startTime + parent.duration);
      const upper = child.startTime - parent.startTime;
      const toChildren = edges.get(parent.serviceName) ?? new Map<string, PairSamples>();
      const known = toChildren.get(child.serviceName) ?? { midpoints: [], lower: -Infinity, upper: Infinity };
      known.midpoints.push((lower + upper) / 2);
      known.lower = Math.max(known.lower, lower);
      known.upper = Math.min(known.upper, upper);
      toChildren.set(child.serviceName, known);
      edges.set(parent.serviceName, toChildren);
    }
  }
  return edges;
}

const pairOffset = ({ midpoints, lower, upper }: PairSamples) => (lower <= upper ? (lower + upper) / 2 : median(midpoints));

function rootCounts(traces: TraceSpan[][]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const span of traces.flat()) if (span.parentSpanId === undefined) counts.set(span.serviceName, (counts.get(span.serviceName) ?? 0) + 1);
  return counts;
}

function solveOffsets(traces: TraceSpan[][]): Map<string, number> {
  const neighbours = new Map<string, Array<[string, number]>>();
  for (const [from, toChildren] of edgeSamples(traces)) {
    for (const [to, samples] of toChildren) {
      const delta = pairOffset(samples);
      neighbours.set(from, [...(neighbours.get(from) ?? []), [to, delta]]);
      neighbours.set(to, [...(neighbours.get(to) ?? []), [from, -delta]]);
    }
  }
  const roots = rootCounts(traces);
  const anchors = [...neighbours.keys()].sort((a, b) => (roots.get(b) ?? 0) - (roots.get(a) ?? 0) || a.localeCompare(b));
  const offsets = new Map<string, number>();
  for (const anchor of anchors) {
    if (offsets.has(anchor)) continue;
    offsets.set(anchor, 0);
    const queue = [anchor];
    for (let head = 0; head < queue.length; head++) {
      const service = queue[head]!;
      for (const [next, delta] of neighbours.get(service) ?? []) {
        if (offsets.has(next)) continue;
        offsets.set(next, offsets.get(service)! + delta);
        queue.push(next);
      }
    }
  }
  return offsets;
}

export function correctClockSkew(traces: TraceSpan[][]): ClockSkewCorrection {
  const none = { traces, offsets: new Map<string, number>() };
  if (measureTraceIntegrity(traces).escapedRatio <= MAX_ESCAPED_RATIO) return none;
  const offsets = solveOffsets(traces);
  return {
    traces: traces.map((trace) => trace.map((span) => ({ ...span, startTime: span.startTime - (offsets.get(span.serviceName) ?? 0) }))),
    offsets,
  };
}
