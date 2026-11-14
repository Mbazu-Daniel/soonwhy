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
  resourceAttributes?: Record<string, unknown>;
  events?: SpanEvent[];
  links?: SpanLink[];
  exceptionType?: string;
  exceptionMessage?: string;
  exceptionStacktrace?: string;
}

export interface SpanEvent {
  name: string;
  timestamp: string;
  attributes: Record<string, unknown>;
}

export interface SpanLink {
  traceId: string;
  spanId: string;
  attributes: Record<string, unknown>;
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
