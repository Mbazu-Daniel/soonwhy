import { createTelemetryIdentity } from "@soonwhy/shared";

export type CacheType = "redis" | "memcached";

export interface CacheTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  dependencyName: string;
  operationName?: string;
  cacheType: CacheType;
  statusCode?: number;
  errorType?: string;
}

export interface CacheCandidate {
  serviceName: string;
  dependencyName: string;
  cacheType: CacheType;
  operationName?: string;
  signal: {
    sampleCount: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
    errorCount: number;
    errorRate: number;
    p95DurationChangePercent?: number;
    degradationSignals: string[];
  };
  samples: CacheTrace[];
  identity: ReturnType<typeof createTelemetryIdentity>;
  recommendation: string;
}

export type RedisTrace = CacheTrace;

export type RedisCandidate = CacheCandidate;
