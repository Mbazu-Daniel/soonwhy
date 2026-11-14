export interface TraceSpan {
  spanId: string;
  parentSpanId?: string;
  name: string;
  duration: number;
  timestamp: string;
  service: string;
  status?: string;
  statusCode?: number | string;
  statusMessage?: string;
  kind?: string;
  attributes?: Record<string, unknown>;
  resource?: Record<string, unknown>;
}

export interface SpanRow {
  span: TraceSpan;
  depth: number;
  offsetMs: number;
  durationMs: number;
  hasChildren: boolean;
  isError: boolean;
}

export interface TraceLayout {
  rows: SpanRow[];
  totalMs: number;
  startMs: number;
  services: string[];
  errorCount: number;
}

export interface ServiceNode {
  service: string;
  spanCount: number;
  totalMs: number;
  errorCount: number;
  layer: number;
}

export interface ServiceEdge {
  from: string;
  to: string;
  count: number;
}
