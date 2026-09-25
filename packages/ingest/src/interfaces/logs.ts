import type { ParsedResource } from './resource';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface ParsedLogRecord {
  timestamp: string;
  severityNumber: number;
  severityText: string;
  severityLevel: LogLevel;
  message: string;
  traceId: string;
  spanId: string;
  resource: ParsedResource;
  attributes: Record<string, unknown>;
}

export interface ParseLogsResult {
  records: ParsedLogRecord[];
  rejected: number;
}
