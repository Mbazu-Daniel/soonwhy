export type NodeSampling =
  | { type: 'always_on' }
  | { type: 'always_off' }
  | { type: 'ratio'; ratio: number };

export interface NodeSdkOptions {
  apiKey: string;
  endpoint?: string;
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  deployment?: string;
  resourceAttributes?: Record<string, string | number | boolean>;
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
}

export interface NodeSdk {
  start(): void;
  shutdown(): Promise<void>;
  isStarted(): boolean;
}
