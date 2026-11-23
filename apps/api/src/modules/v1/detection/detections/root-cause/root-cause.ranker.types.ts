import type { ScoringWeights } from './root-cause.types';

export interface TraceSpan {
  traceId?: string;
  spanId: string;
  serviceName: string;
  operationName?: string;
  duration: number;
  startTime: number;
  parentSpanId?: string;
  isCriticalPath?: boolean;
  isError?: boolean;
}

export interface ErrorData {
  timestamp: string;
  serviceName: string;
  traceId: string;
  errorMessage: string;
}

export interface TraceLoadSummary {
  requested: number;
  loaded: number;
  failed: number;
  notFound: number;
}

export interface RankingInput {
  traceLoad?: TraceLoadSummary;
  errorsTotal?: number;
  findings: Array<{
    id: string;
    type: string;
    serviceName: string;
    operationName?: string;
    traceId?: string;
    timestamp: string;
    severity?: 'warning' | 'critical';
    observedValue?: number;
    baselineValue?: number;
    threshold?: number;
    data?: Record<string, unknown>;
  }>;
  traces?: TraceSpan[][];
  errors?: ErrorData[];
  dependencyMap?: Map<string, { upstream: string[]; downstream: string[] }>;
  weights?: ScoringWeights;
}
