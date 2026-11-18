import type { RawAttribute } from "./attribute-types";

export type OtlpResource = { attributes?: RawAttribute[] };

export type OtlpSpanEvent = {
  name?: string;
  timeUnixNano?: string;
  time_unix_nano?: string;
  attributes?: RawAttribute[];
};

export type OtlpSpanLink = {
  traceId?: string;
  trace_id?: string;
  spanId?: string;
  span_id?: string;
  attributes?: RawAttribute[];
};

export type OtlpSpan = {
  traceId?: string;
  trace_id?: string;
  spanId?: string;
  span_id?: string;
  parentSpanId?: string;
  parent_span_id?: string;
  name?: string;
  kind?: number;
  startTimeUnixNano?: string;
  start_time_unix_nano?: string;
  endTimeUnixNano?: string;
  end_time_unix_nano?: string;
  status?: { code?: number | string; message?: string };
  attributes?: RawAttribute[];
  events?: OtlpSpanEvent[];
  links?: OtlpSpanLink[];
};

export type OtlpScopeSpans = { spans?: OtlpSpan[] };

export type OtlpResourceSpans = {
  resource?: OtlpResource;
  scopeSpans?: OtlpScopeSpans[];
  scope_spans?: OtlpScopeSpans[];
};

export type OtlpTracesPayload = {
  resourceSpans?: OtlpResourceSpans[];
  resource_spans?: OtlpResourceSpans[];
};

export type OtlpLogBody = { stringValue?: string };

export type OtlpLogRecord = {
  timeUnixNano?: string;
  time_unix_nano?: string;
  observedTimeUnixNano?: string;
  observed_time_unix_nano?: string;
  body?: OtlpLogBody | string | null;
  eventName?: string;
  event_name?: string;
  severityNumber?: number | string;
  severity_number?: number | string;
  severityText?: string;
  severity_text?: string;
  traceId?: string;
  trace_id?: string;
  spanId?: string;
  span_id?: string;
  attributes?: RawAttribute[];
};

export type OtlpScopeLogs = {
  logRecords?: OtlpLogRecord[];
  log_records?: OtlpLogRecord[];
};

export type OtlpResourceLogs = {
  resource?: OtlpResource;
  scopeLogs?: OtlpScopeLogs[];
  scope_logs?: OtlpScopeLogs[];
};

export type OtlpLogsPayload = {
  resourceLogs?: OtlpResourceLogs[];
  resource_logs?: OtlpResourceLogs[];
};
