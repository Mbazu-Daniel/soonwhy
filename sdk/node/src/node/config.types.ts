import type { NodeSdkOptions, NodeSampling } from "./types.js";

export interface ResolvedNodeSdkOptions
  extends Omit<NodeSdkOptions, "sampling"> {
  endpoint: string;
  timeoutMs: number;
  sampling: NodeSampling;
  registerShutdownHandlers: boolean;
  captureUncaughtErrors: boolean;
  enableSourceMaps: boolean;
  instrumentations: Required<NonNullable<NodeSdkOptions["instrumentations"]>>;
  batchSize: number;
  flushIntervalMs: number;
  maxRetries: number;
  fetch: typeof globalThis.fetch;
  sleep: (delayMs: number) => Promise<void>;
  redactSensitiveData: boolean;
  maxAttributeCount: number;
  maxAttributeValueLength: number;
}
