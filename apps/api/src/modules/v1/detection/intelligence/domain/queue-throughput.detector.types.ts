import { createTelemetryIdentity } from "@soonwhy/shared";

export type QueueType = "kafka" | "nats" | "rabbitmq" | "other";

export interface QueueOperationTrace {
  timestamp: string;
  service: string;
  traceId: string;
  spanId: string;
  queueName: string;
  queueType: QueueType;
  operationName?: string;
}

export interface QueueThroughputCandidate {
  serviceName: string;
  queueName: string;
  queueType: QueueType;
  operationName?: string;
  signal: {
    currentCount: number;
    baselineCount: number;
    currentPerMinute: number;
    baselinePerMinute: number;
    changePercent: number;
  };
  samples: QueueOperationTrace[];
  identity: ReturnType<typeof createTelemetryIdentity>;
  recommendation: string;
}
