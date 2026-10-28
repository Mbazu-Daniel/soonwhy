import { resolveNodeOptions, type ResolvedNodeSdkOptions } from "./config.js";
import { createOpenTelemetryRuntime } from "./instrumentation.js";
import { TelemetryBatcher } from "../batcher.js";
import { HttpTelemetryTransport } from "../transport.js";
import type { ResolvedOptions } from "../config.js";
import type { NodeSdk, NodeSdkOptions } from "./types.js";
import type { FlushResult, SdkStats } from "../types.js";

let activeClient: Client | undefined;

export class Client implements NodeSdk {
  private readonly options: ResolvedNodeSdkOptions;
  private readonly sdk: ReturnType<typeof createOpenTelemetryRuntime>["sdk"];
  private readonly exporter: ReturnType<
    typeof createOpenTelemetryRuntime
  >["exporter"];
  private readonly batcher: TelemetryBatcher;
  private readonly interval: ReturnType<typeof setInterval> | undefined;
  private started = false;
  private closed = false;
  private shuttingDown: Promise<void> | undefined;
  private readonly shutdownHandlers: Array<() => void> = [];

  constructor(options: NodeSdkOptions) {
    this.options = resolveNodeOptions(options);
    const runtime = createOpenTelemetryRuntime(this.options);
    this.sdk = runtime.sdk;
    this.exporter = runtime.exporter;

    const batcherOptions = this.options as ResolvedOptions;
    this.batcher = new TelemetryBatcher(
      batcherOptions,
      {
        serviceName: options.serviceName,
        serviceVersion: options.serviceVersion,
        deploymentEnvironment: options.environment,
        attributes: {
          ...options.resourceAttributes,
          ...options.attributes,
        },
      },
      new HttpTelemetryTransport(batcherOptions),
    );

    this.interval =
      this.options.flushIntervalMs > 0
        ? setInterval(() => void this.flush(), this.options.flushIntervalMs)
        : undefined;

    if (this.options.registerShutdownHandlers) this.registerShutdownHandlers();
  }

  start(): void {
    if (this.started) return;
    this.sdk.start();
    this.started = true;
  }

  captureLog(input: Parameters<NodeSdk["captureLog"]>[0]): void {
    if (!this.closed) this.batcher.captureLog(input);
  }

  captureError(input: Parameters<NodeSdk["captureError"]>[0]): void {
    if (!this.closed) this.batcher.captureError(input);
  }

  captureMetric(input: Parameters<NodeSdk["captureMetric"]>[0]): void {
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

    const result = await this.batcher.flush();

    if (this.started) {
      await this.sdk.shutdown();
      await this.exporter.shutdown();
    }

    this.started = false;
    if (activeClient === this) activeClient = undefined;
    return result;
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return this.shuttingDown;
    if (!this.started && !this.closed) {
      if (activeClient === this) activeClient = undefined;
      return;
    }

    this.shuttingDown = this.close().then(() => undefined);
    return this.shuttingDown;
  }

  isStarted(): boolean {
    return this.started;
  }

  getStats(): SdkStats {
    return this.batcher.getStats();
  }

  private registerShutdownHandlers(): void {
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      const handler = () => {
        void this.shutdown().finally(() => {
          process.exit(0);
        });
      };
      process.once(signal, handler);
      this.shutdownHandlers.push(() => process.removeListener(signal, handler));
    }
  }

  private removeShutdownHandlers(): void {
    for (const remove of this.shutdownHandlers.splice(0)) remove();
  }
}

export function initNode(options: NodeSdkOptions): NodeSdk {
  if (activeClient) return activeClient;

  const client = new Client(options);
  client.start();
  activeClient = client;
  return client;
}

export async function shutdown(): Promise<void> {
  if (activeClient) await activeClient.shutdown();
}
