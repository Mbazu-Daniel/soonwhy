declare module '@opentelemetry/sdk-node' {
  export interface NodeSDKConfiguration {
    resource?: unknown;
    traceExporter?: unknown;
    instrumentations?: readonly unknown[];
    sampler?: unknown;
  }

  export class NodeSDK {
    constructor(configuration?: NodeSDKConfiguration);
    start(): void;
    shutdown(): Promise<void>;
  }
}

declare module '@opentelemetry/exporter-trace-otlp-proto' {
  export interface OTLPTraceExporterOptions {
    url?: string;
    headers?: Record<string, string>;
    timeoutMillis?: number;
  }

  export class OTLPTraceExporter {
    constructor(options?: OTLPTraceExporterOptions);
    shutdown(): Promise<void>;
  }
}

declare module '@opentelemetry/auto-instrumentations-node' {
  export type InstrumentationConfig = Record<string, unknown>;
  export function getNodeAutoInstrumentations(
    configuration?: Record<string, InstrumentationConfig>,
  ): unknown;
}

declare module '@opentelemetry/resources' {
  export interface Resource {
    merge(other: Resource): Resource;
  }

  export function defaultResource(): Resource;
  export function resourceFromAttributes(attributes: Record<string, unknown>): Resource;
}

declare module '@opentelemetry/sdk-trace-base' {
  export class AlwaysOnSampler {}
  export class AlwaysOffSampler {}
  export class TraceIdRatioBasedSampler {
    constructor(ratio: number);
  }
}

declare module '@opentelemetry/api' {
  export function trace(): unknown;
}
