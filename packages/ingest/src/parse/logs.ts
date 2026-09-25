import { decodeAttributes } from './attributes';
import { nanoTimestamp } from './time';
import { hexId, resourceFromAttributes } from './types';
import type { LogLevel, ParsedLogRecord, ParseLogsResult } from '../interfaces';

export type { LogLevel, ParsedLogRecord, ParseLogsResult };

export function severityLevel(number: number, text: string): LogLevel {
  if (number >= 21) return 'fatal';
  if (number >= 17) return 'error';
  if (number >= 13) return 'warn';
  if (number >= 9) return 'info';
  if (number >= 1) return 'debug';

  const normalized = text.toLowerCase();
  if (/fatal/.test(normalized)) return 'fatal';
  if (/error|err/.test(normalized)) return 'error';
  if (/warn/.test(normalized)) return 'warn';
  if (/trace|debug/.test(normalized)) return 'debug';
  return 'info';
}

function logMessage(body: unknown): string {
  if (typeof body === 'string') return body;
  if (body === null || body === undefined) return '';
  return JSON.stringify(body);
}

export function parseLogsPayload(payload: any): ParseLogsResult {
  const resourceLogs = payload.resourceLogs || payload.resource_logs || [];
  const records: ParsedLogRecord[] = [];
  let rejected = 0;

  for (const rl of resourceLogs) {
    const parsedResource = resourceFromAttributes(
      decodeAttributes(rl.resource?.attributes || []),
    );

    for (const sl of rl.scopeLogs || rl.scope_logs || []) {
      for (const logRecord of sl.logRecords || sl.log_records || []) {
        try {
          const timeNano = logRecord.timeUnixNano || logRecord.time_unix_nano || '0';
          const observedNano =
            logRecord.observedTimeUnixNano || logRecord.observed_time_unix_nano || '0';
          const timestamp = nanoTimestamp(timeNano) || nanoTimestamp(observedNano);
          const body = logRecord.body?.stringValue ?? logRecord.body ?? null;
          const message = (
            logMessage(body) ||
            logRecord.eventName ||
            logRecord.event_name ||
            logRecord.severityText ||
            logRecord.severity_text ||
            '(empty log record)'
          ).slice(0, 262_144);

          if (!timestamp || !message) {
            rejected++;
            continue;
          }

          const rawSeverityNumber = Number(
            logRecord.severityNumber || logRecord.severity_number || 0,
          );
          const severityNumber =
            Number.isInteger(rawSeverityNumber) &&
            rawSeverityNumber >= 0 &&
            rawSeverityNumber <= 24
              ? rawSeverityNumber
              : 0;
          const severityText = logRecord.severityText || logRecord.severity_text || '';

          records.push({
            timestamp,
            severityNumber,
            severityText,
            severityLevel: severityLevel(severityNumber, severityText),
            message,
            traceId: hexId(logRecord.traceId || logRecord.trace_id || '', 32),
            spanId: hexId(logRecord.spanId || logRecord.span_id || '', 16),
            resource: parsedResource,
            attributes: decodeAttributes(logRecord.attributes || []),
          });
        } catch {
          rejected++;
        }
      }
    }
  }

  return { records, rejected };
}
