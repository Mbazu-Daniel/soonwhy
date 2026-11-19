export interface RawLogRow {
  id: string;
  timestamp: string;
  level: string;
  service: string;
  message: string;
  traceId?: string;
  spanId?: string;
  stackTrace?: string;
  attributes: Record<string, unknown> | string;
}

export interface LogFilter {
  orgId: string;
  projectId: string;
  from: string;
  to: string;
  level: string;
  service: string;
  q: string;
  traceId?: string;
  spanId?: string;
}
