export interface TraceFilter {
  q?: string;
  traceIds?: string[];
  service?: string;
  operation?: string;
  minDuration?: number;
  maxDuration?: number;
}
