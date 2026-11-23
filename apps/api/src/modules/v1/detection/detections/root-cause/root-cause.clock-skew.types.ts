import type { TraceSpan } from "./root-cause.ranker.types";

export interface ClockSkewCorrection {
  traces: TraceSpan[][];
  offsets: Map<string, number>;
}
