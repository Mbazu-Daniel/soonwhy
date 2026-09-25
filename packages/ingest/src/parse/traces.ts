import { decodeAttributes } from './attributes';
import { nanoToMs } from './time';
import { hexId, resourceFromAttributes } from './types';
import type { ParsedSpan, ParseTracesResult } from '../interfaces';

export type { ParsedSpan, ParseTracesResult };

export function parseTracesPayload(payload: any): ParseTracesResult {
  const resourceSpans = payload.resourceSpans || payload.resource_spans || [];
  const spans: ParsedSpan[] = [];
  let rejected = 0;

  for (const rs of resourceSpans) {
    const parsedResource = resourceFromAttributes(
      decodeAttributes(rs.resource?.attributes || []),
    );

    for (const ss of rs.scopeSpans || rs.scope_spans || []) {
      for (const span of ss.spans || []) {
        try {
          const traceId = hexId(span.traceId || span.trace_id || '', 32);
          const spanId = hexId(span.spanId || span.span_id || '', 16);
          if (!traceId || !spanId) {
            rejected++;
            continue;
          }

          const startTimeUnixNano = span.startTimeUnixNano || span.start_time_unix_nano || '0';
          const endTimeUnixNano = span.endTimeUnixNano || span.end_time_unix_nano || '0';
          const status = span.status || {};

          spans.push({
            traceId,
            spanId,
            parentSpanId: hexId(span.parentSpanId || span.parent_span_id || '', 16),
            name: span.name || '',
            kind: span.kind || 0,
            startTimeUnixNano,
            endTimeUnixNano,
            durationMs: nanoToMs(endTimeUnixNano) - nanoToMs(startTimeUnixNano),
            statusCode: status.code || 0,
            statusMessage: status.message || '',
            resource: parsedResource,
            attributes: decodeAttributes(span.attributes || []),
          });
        } catch {
          rejected++;
        }
      }
    }
  }

  return { spans, rejected };
}
