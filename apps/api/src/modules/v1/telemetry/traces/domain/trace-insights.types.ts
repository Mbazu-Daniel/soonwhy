import type { CriticalPathStep, TraceInsight, TraceInsights } from "@soonwhy/shared/contracts";

export type { CriticalPathStep, TraceInsight, TraceInsights };

export type InsightSpan = {
  spanId: string;
  parentSpanId: string;
  name: string;
  service: string;
  duration: number;
  timestamp: string;
  statusCode?: number | string;
  statusMessage?: string;
  exceptionMessage?: string;
  attributes?: Record<string, unknown>;
};

export type SpanNode = InsightSpan & { start: number; end: number; children: SpanNode[]; selfMs: number };
