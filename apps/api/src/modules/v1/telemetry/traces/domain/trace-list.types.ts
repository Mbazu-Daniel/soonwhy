export interface EntrySpan {
  traceId: string;
  name?: string;
  service?: string;
  timestamp: string;
  duration?: number | string;
  statusCode?: number | string;
}

export interface TraceListRow {
  traceId: string;
  name: string;
  rootService: string;
  rootOperation: string;
  start: string;
  end: string;
  startTime: string;
  durationMs: number;
  spanCount: number;
  errorCount: number;
  status: "ok" | "error";
}
