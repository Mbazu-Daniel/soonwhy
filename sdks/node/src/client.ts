import { resolveNodeOptions, type ResolvedNodeSdkOptions } from './config.js';
import { createOpenTelemetryRuntime } from './instrumentation.js';
import type { NodeSdk, NodeSdkOptions } from './types.js';

let activeClient: Client | undefined;

export class Client implements NodeSdk {
  private readonly options: ResolvedNodeSdkOptions;
  private readonly sdk: ReturnType<typeof createOpenTelemetryRuntime>['sdk'];
  private started = false;
  private shuttingDown: Promise<void> | undefined;
  private readonly shutdownHandlers: Array<() => void> = [];

  constructor(options: NodeSdkOptions) {
    this.options = resolveNodeOptions(options);
    const runtime = createOpenTelemetryRuntime(this.options);
    this.sdk = runtime.sdk;
  }

  start(): void {
    if (this.started) return;
    this.sdk.start();
    this.started = true;
    if (this.options.registerShutdownHandlers) this.registerShutdownHandlers();
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return this.shuttingDown;
    if (!this.started) {
      if (activeClient === this) activeClient = undefined;
      return;
    }

    this.shuttingDown = this.shutdownInternal();
    return this.shuttingDown;
  }

  isStarted(): boolean {
    return this.started;
  }

  private async shutdownInternal(): Promise<void> {
    this.started = false;
    this.removeShutdownHandlers();

    try {
      await this.sdk.shutdown();
    } finally {
      if (activeClient === this) activeClient = undefined;
    }
  }

  private registerShutdownHandlers(): void {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
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
