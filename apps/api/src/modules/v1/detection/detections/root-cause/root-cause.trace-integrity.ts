import { MAX_ESCAPED_RATIO, MAX_ORPHAN_RATIO, SKEW_TOLERANCE_MS } from "./root-cause.constants";
import type { TraceSpan } from "./root-cause.ranker.types";
import type { TraceIntegrity } from "./root-cause.trace-integrity.types";

const percent = (ratio: number) => Math.round(ratio * 100);

export function measureTraceIntegrity(traces: TraceSpan[][]): TraceIntegrity {
  let children = 0;
  let orphans = 0;
  let parented = 0;
  let escaped = 0;
  for (const trace of traces) {
    const byId = new Map(trace.map((span) => [span.spanId, span]));
    for (const span of trace) {
      if (span.parentSpanId === undefined) continue;
      children++;
      const parent = byId.get(span.parentSpanId);
      if (!parent) {
        orphans++;
        continue;
      }
      parented++;
      const startsBefore = span.startTime < parent.startTime - SKEW_TOLERANCE_MS;
      const endsAfter = span.startTime + span.duration > parent.startTime + parent.duration + SKEW_TOLERANCE_MS;
      if (startsBefore || endsAfter) escaped++;
    }
  }
  return { orphanRatio: children === 0 ? 0 : orphans / children, escapedRatio: parented === 0 ? 0 : escaped / parented };
}

export function traceIntegrityLimitation(traces: TraceSpan[][]): string | undefined {
  const { orphanRatio, escapedRatio } = measureTraceIntegrity(traces);
  const problems: string[] = [];
  if (orphanRatio > MAX_ORPHAN_RATIO) problems.push(`${percent(orphanRatio)}% of spans have a parent that is missing from the trace`);
  if (escapedRatio > MAX_ESCAPED_RATIO) {
    problems.push(`${percent(escapedRatio)}% of spans fall outside their parent's time range, so service clocks may disagree`);
  }
  return problems.length === 0 ? undefined : `Trace data looks unreliable: ${problems.join("; ")}`;
}
