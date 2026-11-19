export interface ExtentSpan {
  traceId: string;
  timestamp: string;
  duration?: number | string;
}

export type TraceExtents = Map<string, number>;
