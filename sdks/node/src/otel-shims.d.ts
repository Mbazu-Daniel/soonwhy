declare module '@opentelemetry/sdk-node' {
  export class NodeSDK {
    constructor(configuration: Record<string, unknown>);
    start(): void;
    shutdown(): Promise<void>;
  }
}

declare module '@opentelemetry/exporter-trace-otlp-proto' {
  export class OTLPTraceExporter {
    constructor(options: {
      url: string;
      headers: Record<string, string>;
      timeoutMillis: number;
    });
    shutdown(): Promise<void>;
  }
}

declare module '@opentelemetry/auto-instrumentations-node' {
  export function getNodeAutoInstrumentations(
    configuration?: Record<string, Record<string, unknown>>,
  ): unknown;
}

declare module '@opentelemetry/resources' {
  export function defaultResource(): {
    merge(other: unknown): unknown;
  };
  export function resourceFromAttributes(attributes: Record<string, unknown>): unknown;
}

declare module '@opentelemetry/sdk-trace-base' {
  export class AlwaysOnSampler {}
  export class AlwaysOffSampler {}
  export class TraceIdRatioBasedSampler {
    constructor(ratio: number);
  }
}
