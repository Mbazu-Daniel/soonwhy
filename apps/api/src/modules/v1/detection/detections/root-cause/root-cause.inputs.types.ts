export interface SpanRecord {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  duration: number;
  timestamp: string;
  service: string;
  statusCode?: number | string;
  statusMessage?: string;
  exceptionMessage?: string;
}

export interface TraceLoad {
  traces: SpanRecord[][];
  failed: string[];
  notFound: string[];
  requested: number;
}

export interface TraceSource {
  getTrace(orgId: string, projectId: string, traceId: string): Promise<{ spans: readonly unknown[] }>;
}

export interface RankingTelemetry {
  loadTraces(orgId: string, projectId: string, traceIds: string[]): Promise<TraceLoad>;
}
