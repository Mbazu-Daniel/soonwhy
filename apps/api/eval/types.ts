export interface SpanRecord {
  service: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: "server" | "client";
  peer?: string;
  start: number;
  end: number;
  error: boolean;
}

export interface RankedService {
  service: string;
  score: number;
}

export interface AnalysisSnapshot {
  at: number;
  full: RankedService[];
  anomalyOnly: RankedService[];
  criticalPathOnly: RankedService[];
  firstError: RankedService[];
  findingServices: string[];
}

export interface AnalyzerOptions {
  baselineWindow: number;
  recentWindow: number;
  errorWindow: number;
  traceWindow: number;
}
