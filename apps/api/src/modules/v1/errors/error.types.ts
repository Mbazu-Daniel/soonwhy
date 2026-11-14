export interface ErrorLogSource {
  id?: string;
  timestamp?: string;
  service?: string;
  level?: string;
  message?: string;
  traceId?: string;
  spanId?: string;
  stackTrace?: string;
  attributes?: Record<string, unknown> | string;
}

export interface ErrorOccurrence {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  traceId: string;
  spanId: string;
  stackTrace: string;
  attributes: Record<string, unknown>;
}

export interface ErrorGroup {
  fingerprint: string;
  errorMessage: string;
  errorType: string;
  service: string;
  level: string;
  count: number;
  traceCount: number;
  firstSeen: string;
  lastSeen: string;
  traceId: string;
  spanId: string;
  logId: string;
  exception: string;
}

export interface ErrorTimelineBucket {
  start: string;
  count: number;
}

export interface ErrorGroupDetail extends ErrorGroup {
  occurrences: ErrorOccurrence[];
  timeline: ErrorTimelineBucket[];
}

export interface ErrorRange {
  start: number;
  end: number;
  startTimestamp: number;
  endTimestamp: number;
}
