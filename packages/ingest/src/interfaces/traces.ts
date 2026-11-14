import type { ParsedResource } from "./resource";

export interface ParsedSpanEvent {
  name: string;
  timeUnixNano: string;
  attributes: Record<string, unknown>;
}

export interface ParsedSpanLink {
  traceId: string;
  spanId: string;
  attributes: Record<string, unknown>;
}

export interface ParsedSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  durationMs: number;
  statusCode: number;
  statusMessage: string;
  resource: ParsedResource;
  attributes: Record<string, unknown>;
  events: ParsedSpanEvent[];
  links: ParsedSpanLink[];
}

export interface ParseTracesResult {
  spans: ParsedSpan[];
  rejected: number;
}
