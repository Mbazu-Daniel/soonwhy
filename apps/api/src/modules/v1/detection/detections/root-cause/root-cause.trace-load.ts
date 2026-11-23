import { MIN_TRACE_LOAD_RATIO } from "./root-cause.constants";
import type { TraceLoadSummary } from "./root-cause.ranker.types";

export function traceLoadLimitation(load: TraceLoadSummary | undefined): string | undefined {
  if (!load || load.requested === 0 || load.loaded >= load.requested) return undefined;
  const parts = [
    load.failed > 0 ? `${load.failed} failed` : undefined,
    load.notFound > 0 ? `${load.notFound} not found` : undefined,
  ].filter((part): part is string => part !== undefined);
  return `Loaded ${load.loaded} of ${load.requested} traces (${parts.join(", ")})`;
}

export function loadedTooFewTraces(load: TraceLoadSummary | undefined): boolean {
  return load !== undefined && load.requested > 0 && load.loaded / load.requested < MIN_TRACE_LOAD_RATIO;
}
