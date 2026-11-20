import { type TraceFilter } from "./trace-filters.types";

export interface TraceRow {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  name: string;
  duration: number;
  timestamp: string;
  service: string;
  statusCode?: number | string;
  statusMessage?: string;
  attributes?: Record<string, unknown>;
  resourceAttributes?: Record<string, unknown>;
  events?: Array<{ name: string; timestamp: string; attributes: Record<string, unknown> }>;
  links?: Array<{ traceId: string; spanId: string; attributes: Record<string, unknown> }>;
  exceptionType?: string;
  exceptionMessage?: string;
  exceptionStacktrace?: string;
}

export interface TraceScope extends TraceFilter {
  orgId: string;
  projectId: string;
  from: string;
  to: string;
  status?: "ok" | "error";
}

export interface CountBuckets {
  buckets?: Array<{ key: string | number; doc_count: number }>;
}

export interface TimelineBuckets {
  buckets?: Array<{
    key: number;
    doc_count: number;
    p95?: { values?: Record<string, number | null> };
    avg?: { value?: number | null };
  }>;
}
