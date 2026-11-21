import type { QueryHint, TraceQuery, TraceQuerySummary } from "@soonwhy/shared/contracts";

export type { QueryHint, TraceQuery, TraceQuerySummary };

export type QuerySpan = {
  spanId: string;
  duration: number;
  dbQueryText?: unknown;
  attributes?: Record<string, unknown>;
};
