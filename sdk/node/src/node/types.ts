import type { Attributes, SoonwhyClient } from "../types.js";
export type NodeSampling =
  | { type: "always_on" }
  | { type: "always_off" }
  | { type: "ratio"; ratio: number };

export interface NodeSdkOptions {
  apiKey: string;
  endpoint?: string;
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  deployment?: string;
  resourceAttributes?: Record<string, string | number | boolean>;
  attributes?: Attributes;
  timeoutMs?: number;
  sampling?: NodeSampling;
  registerShutdownHandlers?: boolean;
  instrumentations?: {
    http?: boolean;
    express?: boolean;
    nestjs?: boolean;
    postgres?: boolean;
    redis?: boolean;
    ioredis?: boolean;
  };
  batchSize?: number;
  flushIntervalMs?: number;
  maxRetries?: number;
  fetch?: typeof globalThis.fetch;
  sleep?: (delayMs: number) => Promise<void>;
  redactSensitiveData?: boolean;
  maxAttributeCount?: number;
  maxAttributeValueLength?: number;
}

export interface NodeSdk extends SoonwhyClient {
  start(): void;
  shutdown(): Promise<void>;
  isStarted(): boolean;
}
