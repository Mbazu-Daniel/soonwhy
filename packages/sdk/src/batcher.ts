import type { ResolvedOptions } from './config.js';
import { toErrorLog, toLogsPayload, toMetricsPayload } from './otlp.js';
import type { ErrorInput, FlushResult, LogInput, MetricInput, ResourceOptions } from './types.js';
import type { TelemetryTransport } from './transport.js';

export class TelemetryBatcher {
  private readonly logs: LogInput[] = [];
  private readonly metrics: MetricInput[] = [];
  private pendingFlush: Promise<FlushResult> | undefined;
  private sent = 0;
  private dropped = 0;

  constructor(
    private readonly options: ResolvedOptions,
    private readonly resource: ResourceOptions,
    private readonly transport: TelemetryTransport,
  ) {}

  captureLog(input: LogInput): void {
    this.logs.push(input);
    this.scheduleFlushIfFull();
  }

  captureError(input: ErrorInput): void {
    this.captureLog(toErrorLog(input));
  }

  captureMetric(input: MetricInput): void {
    this.metrics.push(input);
    this.scheduleFlushIfFull();
  }

  async flush(): Promise<FlushResult> {
    if (this.pendingFlush) return this.pendingFlush;
    this.pendingFlush = this.flushInternal().finally(() => {
      this.pendingFlush = undefined;
    });
    return this.pendingFlush;
  }

  getStats() {
    return {
      queued: this.logs.length + this.metrics.length,
      sent: this.sent,
      dropped: this.dropped,
    };
  }

  private async flushInternal(): Promise<FlushResult> {
    const logs = this.logs.splice(0);
    const metrics = this.metrics.splice(0);
    let sent = 0;
    let dropped = 0;

    const results = await Promise.all([
      logs.length ? this.transport.send('logs', toLogsPayload(logs, this.resource, '0.1.0', this.options)) : Promise.resolve(true),
      metrics.length ? this.transport.send('metrics', toMetricsPayload(metrics, this.resource, '0.1.0', this.options)) : Promise.resolve(true),
    ]);

    if (logs.length) {
      if (results[0]) sent += logs.length;
      else dropped += logs.length;
    }
    if (metrics.length) {
      if (results[1]) sent += metrics.length;
      else dropped += metrics.length;
    }

    this.sent += sent;
    this.dropped += dropped;
    return { sent, dropped };
  }

  private scheduleFlushIfFull(): void {
    if (this.logs.length + this.metrics.length >= this.options.batchSize) void this.flush();
  }
}
