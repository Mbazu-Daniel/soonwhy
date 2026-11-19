import type { SoonwhyOptions } from "./types.js";
import { type SecurityOptions } from "./security.types.js";

export interface ResolvedOptions
  extends Omit<SoonwhyOptions, keyof SecurityOptions>,
    SecurityOptions {
  endpoint: string;
  batchSize: number;
  flushIntervalMs: number;
  maxRetries: number;
  timeoutMs: number;
  registerShutdownHandlers: boolean;
  fetch: typeof globalThis.fetch;
  sleep: (delayMs: number) => Promise<void>;
}
