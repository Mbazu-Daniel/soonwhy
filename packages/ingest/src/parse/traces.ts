import { decodeAttributes } from "./attributes";
import { nanoToMs } from "./time";
import type { OtlpSpanEvent, OtlpSpanLink, OtlpTracesPayload } from "./otlp.types";
import { hexId, resourceFromAttributes } from "./types";
import type {
  ParsedSpan,
  ParsedSpanEvent,
  ParsedSpanLink,
  ParseTracesResult,
} from "../interfaces";

export type { ParseTracesResult };

const STATUS_CODE_NAMES: Record<string, number> = {
  STATUS_CODE_UNSET: 0,
  STATUS_CODE_OK: 1,
  STATUS_CODE_ERROR: 2,
};

function normalizeStatusCode(code: unknown): number {
  if (typeof code === "number") return code;
  if (typeof code === "string") return STATUS_CODE_NAMES[code] ?? (Number(code) || 0);
  return 0;
}

function parseEvents(events: OtlpSpanEvent[] | undefined): ParsedSpanEvent[] {
  return (events ?? []).map((event) => ({
    name: String(event.name ?? ""),
    timeUnixNano: String(event.timeUnixNano ?? event.time_unix_nano ?? "0"),
    attributes: decodeAttributes(event.attributes || []),
  }));
}

function parseLinks(links: OtlpSpanLink[] | undefined): ParsedSpanLink[] {
  return (links ?? []).flatMap((link) => {
    const traceId = hexId(link.traceId || link.trace_id || "", 32);
    const spanId = hexId(link.spanId || link.span_id || "", 16);
    if (!traceId || !spanId) return [];
    return [{ traceId, spanId, attributes: decodeAttributes(link.attributes || []) }];
  });
}

export function parseTracesPayload(payload: OtlpTracesPayload): ParseTracesResult {
  const resourceSpans = payload.resourceSpans || payload.resource_spans || [];
  const spans: ParsedSpan[] = [];
  let rejected = 0;

  for (const rs of resourceSpans) {
    const parsedResource = resourceFromAttributes({
      attributes: decodeAttributes(rs.resource?.attributes || []),
      serviceName: "",
      serviceVersion: "",
      environment: "",
      region: "",
    });

    for (const ss of rs.scopeSpans || rs.scope_spans || []) {
      for (const span of ss.spans || []) {
        try {
          const traceId = hexId(span.traceId || span.trace_id || "", 32);
          const spanId = hexId(span.spanId || span.span_id || "", 16);
          if (!traceId || !spanId) {
            rejected++;
            continue;
          }

          const startTimeUnixNano =
            span.startTimeUnixNano || span.start_time_unix_nano || "0";
          const endTimeUnixNano =
            span.endTimeUnixNano || span.end_time_unix_nano || "0";
          const status = span.status || {};

          spans.push({
            traceId,
            spanId,
            parentSpanId: hexId(
              span.parentSpanId || span.parent_span_id || "",
              16,
            ),
            name: span.name || "",
            kind: span.kind || 0,
            startTimeUnixNano,
            endTimeUnixNano,
            durationMs: nanoToMs(endTimeUnixNano) - nanoToMs(startTimeUnixNano),
            statusCode: normalizeStatusCode(status.code),
            statusMessage: status.message || "",
            resource: parsedResource,
            attributes: decodeAttributes(span.attributes || []),
            events: parseEvents(span.events),
            links: parseLinks(span.links),
          });
        } catch {
          rejected++;
        }
      }
    }
  }

  return { spans, rejected };
}
