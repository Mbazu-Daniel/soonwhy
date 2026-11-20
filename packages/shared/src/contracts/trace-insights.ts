export type TraceInsightKind =
  | "dominant_span"
  | "slow_dependency"
  | "sequential_calls"
  | "repeated_calls"
  | "error_origin";

export type TraceInsightSeverity = "info" | "warning" | "critical";

export type TraceInsight = {
  kind: TraceInsightKind;
  severity: TraceInsightSeverity;
  title: string;
  detail: string;
  spanIds: string[];
  impactMs: number;
};

export type CriticalPathStep = {
  spanId: string;
  name: string;
  service: string;
  durationMs: number;
  selfMs: number;
};

export type TraceInsights = {
  durationMs: number;
  criticalPath: CriticalPathStep[];
  findings: TraceInsight[];
};
