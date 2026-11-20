import { TraceRow } from "./traces.repository.types";

export interface TraceSpan extends TraceRow {
  children: TraceSpan[];
}
