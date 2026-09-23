import { resolveNodeOptions, type ResolvedNodeSdkOptions } from './config.js';
import { createOpenTelemetryRuntime } from './instrumentation.js';
import type { NodeSdk, NodeSdkOptions } from './types.js';

let activeClient: Client | undefined;

export class Client implements NodeSdk {
  private readonly options: ResolvedNodeSdkOptions;
  private readonly sdk: ReturnType<typeof createOpenTelemetryRuntime>['sdk'];
  private readonly exporter: ReturnType<typeof createOpenTelemetryRuntime>['exporter'];
  private started = false;
  private readonly shutdownHandlers: Array<() => void> = [];

  constructor(options: NodeSdkOptions) {
    this.options = resolveNodeOptions(options);
    const runtime = createOpenTelemetryRuntime(this.options);
    this.sdk = runtime.sdk;
    this.exporter = runtime.exporter;

    if (this.options.registerShutdownHandlers) {
      this.registerShutdownHandlers();
    }
  }

  start(): void {
    if (this.started) return;
    this.sdk.start();
    this.started = true;
  }

  async shutdown(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    this.removeShutdownHandlers();

    try {
      await this.sdk.shutdown();
    } finally {
      await this.exporter.shutdown();
    }

    if (activeClient === this) activeClient = undefined;
  }

  isStarted(): boolean {
    return this.started;
  }

  private registerShutdownHandlers(): void {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      const handler = () => {
        void this.shutdown();
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
  activeClient = client;
  client.start();
  return client;
}

export async function shutdown(): Promise<void> {
  if (activeClient) await activeClient.shutdown();
}
