import type { SoonwhyOptions } from './types.js';
import { DEFAULT_SECURITY_OPTIONS, type SecurityOptions } from './security.js';

export const DEFAULT_ENDPOINT = 'http://localhost:3002/v1';
export const DEFAULT_BATCH_SIZE = 100;
export const DEFAULT_FLUSH_INTERVAL_MS = 5_000;
export const DEFAULT_MAX_RETRIES = 3;

export interface ResolvedOptions extends SoonwhyOptions, SecurityOptions {
  endpoint: string;
  batchSize: number;
  flushIntervalMs: number;
  maxRetries: number;
  registerShutdownHandlers: boolean;
  fetch: typeof globalThis.fetch;
  sleep: (delayMs: number) => Promise<void>;
}

export function resolveOptions(options: SoonwhyOptions): ResolvedOptions {
  if (!options.apiKey.trim()) throw new Error('Soonwhy apiKey is required');

  const endpoint = normalizeEndpoint(options.endpoint ?? DEFAULT_ENDPOINT);
  if (!/^https?:\/\//i.test(endpoint)) {
    throw new Error('Soonwhy endpoint must use http or https');
  }

  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('Soonwhy batchSize must be a positive integer');
  }

  const flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
  if (!Number.isFinite(flushIntervalMs) || flushIntervalMs < 0) {
    throw new Error('Soonwhy flushIntervalMs must be a non-negative number');
  }

  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new Error('Soonwhy maxRetries must be a non-negative integer');
  }

  return {
    ...options,
    endpoint,
    batchSize,
    flushIntervalMs,
    maxRetries,
    registerShutdownHandlers: options.registerShutdownHandlers ?? true,
    fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
    sleep: options.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs))),
    redactSensitiveData: options.redactSensitiveData ?? DEFAULT_SECURITY_OPTIONS.redactSensitiveData,
    maxAttributeCount: options.maxAttributeCount ?? DEFAULT_SECURITY_OPTIONS.maxAttributeCount,
    maxAttributeValueLength: options.maxAttributeValueLength ?? DEFAULT_SECURITY_OPTIONS.maxAttributeValueLength,
  };
}

function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed) throw new Error('Soonwhy endpoint is required');
  return trimmed.replace(/\/+$/, '');
}
