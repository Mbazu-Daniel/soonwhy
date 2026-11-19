import { createTelemetryIdentity } from "@soonwhy/shared";

export type QueueType = "kafka" | "nats" | "rabbitmq" | "other";

export interface QueueTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  duration: number;
  queueName: string;
  queueType: QueueType;
  operationName?: string;
  statusCode?: number;
  errorType?: string;
}

export interface QueueCandidate {
  serviceName: string;
  queueName: string;
  queueType: QueueType;
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
  samples: QueueTrace[];
  identity: ReturnType<typeof createTelemetryIdentity>;
  recommendation: string;
}
