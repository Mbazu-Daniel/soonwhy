export interface ErrorEvent {
  serviceName: string;
  endpoint?: string;
  traceId: string;
  timestamp: string;
  exceptionType?: string;
  message: string;
  stack?: string;
}

export interface ErrorWindow {
  errorCount: number;
  requestCount: number;
  affectedTraceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface ErrorBaseline {
  errorCount: number;
  requestCount: number;
}

export interface ErrorSignal {
  severity: "warning" | "critical";
  fingerprint: string;
  errorRate: number;
  errorCount: number;
  affectedTraceCount: number;
  errorRateChangePercent?: number;
  countChangePercent?: number;
  firstSeenAt: string;
  lastSeenAt: string;
  identity: {
    exceptionType?: string;
    normalizedMessage: string;
    stackFrame?: string;
  };
}
