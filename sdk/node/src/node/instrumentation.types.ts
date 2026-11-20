export interface OTelRuntime {
  sdk: {
    start(): void;
    shutdown(): Promise<void>;
  };
  exporter: {
    shutdown(): Promise<void>;
  };
}
