export type IssueStatus = 'unresolved' | 'resolved' | 'ignored' | 'regressed';

export interface ErrorIssueState {
  status: IssueStatus;
  resolvedAt: string | null;
}

export interface ErrorGroup {
  issue: ErrorIssueState;
  scannerProbe?: boolean;
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
  occurrences: ErrorOccurrence[];
  traceIds: string[];
  timeline: Array<{ start: string; count: number }>;
}

export interface FindingResult {
  status: 'created' | 'updated';
  finding: { id: string; title: string };
}

export function shortId(value: string): string {
  return value ? value.slice(0, 8) : '—';
}
