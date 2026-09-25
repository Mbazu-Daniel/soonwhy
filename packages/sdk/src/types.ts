export type AttributeValue =
  | string
  | number
  | boolean
  | null
  | AttributeValue[]
  | { [key: string]: AttributeValue };

export type Attributes = Record<string, AttributeValue>;
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogInput {
  level?: LogLevel;
  message: string;
  timestamp?: Date | number;
  attributes?: Attributes;
  traceId?: string;
  spanId?: string;
}

export interface ErrorInput {
  error: unknown;
  timestamp?: Date | number;
  attributes?: Attributes;
  traceId?: string;
  spanId?: string;
}

export interface MetricInput {
  name: string;
  value: number;
  unit?: string;
  timestamp?: Date | number;
  attributes?: Attributes;
}

export interface ResourceOptions {
  serviceName?: string;
  serviceVersion?: string;
  deploymentEnvironment?: string;
  attributes?: Attributes;
}

export interface SoonwhyOptions extends ResourceOptions {
  apiKey: string;
  endpoint?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  maxRetries?: number;
  registerShutdownHandlers?: boolean;
  fetch?: typeof globalThis.fetch;
  sleep?: (delayMs: number) => Promise<void>;
}

export interface FlushResult {
  sent: number;
  dropped: number;
}

export interface SdkStats {
  queued: number;
  sent: number;
  dropped: number;
}

export interface SoonwhyClient {
  captureLog(input: LogInput): void;
  captureError(input: ErrorInput): void;
  captureMetric(input: MetricInput): void;
  flush(): Promise<FlushResult>;
  close(): Promise<FlushResult>;
  getStats(): SdkStats;
}
