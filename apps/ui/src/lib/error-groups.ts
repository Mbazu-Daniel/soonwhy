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

export interface ErrorGroupDetail extends ErrorGroup {
  occurrences: ErrorOccurrence[];
  timeline: Array<{ start: string; count: number }>;
}

export interface FindingResult {
  status: 'created' | 'updated';
  finding: { id: string; title: string };
}

export function shortId(value: string): string {
  return value ? value.slice(0, 8) : '—';
}
