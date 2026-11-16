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

export interface TraceException {
  type: string;
  message: string;
  stacktrace: string;
  spanName: string;
  spanId: string;
}

export interface ErrorGroupDetail extends ErrorGroup {
  traceException: TraceException | null;
  findingId: string | null;
  issue: ErrorIssueState;
  occurrences: ErrorOccurrence[];
  traceIds: string[];
  timeline: ErrorTimelineBucket[];
}

export interface ErrorRange {
  start: number;
  end: number;
  startTimestamp: number;
  endTimestamp: number;
}

export interface RequestErrorSource {
  id?: string;
  eventId?: string;
  timestamp?: string;
  service?: string;
  method?: string;
  route?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  traceId?: string;
  spanId?: string;
}

export interface SpanErrorSource {
  id?: string;
  eventId?: string;
  timestamp?: string;
  service?: string;
  traceId?: string;
  spanId: string;
  name?: string;
  statusCode?: number | string;
  statusMessage?: string;
  httpStatusCode?: number;
  errorType?: string;
  exceptionType?: string;
  exceptionMessage?: string;
  exceptionStacktrace?: string;
  attributes?: Record<string, unknown>;
}
export type ErrorIssueStatus = "unresolved" | "resolved" | "ignored" | "regressed";
export type ErrorIssueStatusInput = "unresolved" | "resolved" | "ignored";

export interface ErrorIssueState {
  status: ErrorIssueStatus;
  resolvedAt: string | null;
}

export type ErrorGroupSummary = ErrorGroup & { issue: ErrorIssueState };
