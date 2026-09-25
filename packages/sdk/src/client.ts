import { resolveOptions, type ResolvedOptions } from './config.js';
import { TelemetryBatcher } from './batcher.js';
import { HttpTelemetryTransport } from './transport.js';
import type {
  ErrorInput,
  FlushResult,
  LogInput,
  MetricInput,
  SdkStats,
  SoonwhyClient,
  SoonwhyOptions,
} from './types.js';

export const SDK_VERSION = '0.1.0';

export class Client implements SoonwhyClient {
  private readonly options: ResolvedOptions;
  private readonly batcher: TelemetryBatcher;
  private readonly interval: ReturnType<typeof setInterval> | undefined;
  private closed = false;
  private readonly shutdownHandlers: Array<() => void> = [];

  constructor(options: SoonwhyOptions) {
    this.options = resolveOptions(options);
    this.batcher = new TelemetryBatcher(
      this.options,
      {
        serviceName: options.serviceName,
        serviceVersion: options.serviceVersion,
        deploymentEnvironment: options.deploymentEnvironment,
        attributes: options.attributes,
      },
      new HttpTelemetryTransport(this.options),
    );

    this.interval = this.options.flushIntervalMs > 0
      ? setInterval(() => void this.flush(), this.options.flushIntervalMs)
      : undefined;

    if (this.options.registerShutdownHandlers) this.registerShutdownHandlers();
  }

  captureLog(input: LogInput): void {
    if (!this.closed) this.batcher.captureLog(input);
  }

  captureError(input: ErrorInput): void {
    if (!this.closed) this.batcher.captureError(input);
  }

  captureMetric(input: MetricInput): void {
    if (!this.closed) this.batcher.captureMetric(input);
  }

  flush(): Promise<FlushResult> {
    return this.batcher.flush();
  }

  async close(): Promise<FlushResult> {
    if (this.closed) return { sent: 0, dropped: 0 };
    this.closed = true;
    if (this.interval) clearInterval(this.interval);
    this.removeShutdownHandlers();
    return this.batcher.flush();
  }

  getStats(): SdkStats {
    return this.batcher.getStats();
  }

  private registerShutdownHandlers(): void {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      const handler = () => { void this.close(); };
      process.once(signal, handler);
      this.shutdownHandlers.push(() => process.removeListener(signal, handler));
    }
  }

  private removeShutdownHandlers(): void {
    for (const remove of this.shutdownHandlers.splice(0)) remove();
  }
}

export function init(options: SoonwhyOptions): SoonwhyClient {
  return new Client(options);
}
