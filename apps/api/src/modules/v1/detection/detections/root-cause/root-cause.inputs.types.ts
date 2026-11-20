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

export interface RankingTelemetry {
  loadTraces(orgId: string, projectId: string, traceIds: string[]): Promise<SpanRecord[][]>;
}
