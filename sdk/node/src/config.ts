import type { SoonwhyOptions } from "./types.js";
import { DEFAULT_SECURITY_OPTIONS } from "./security.constants.js";
import type { ResolvedOptions } from "./config.types.js";
import { DEFAULT_ENDPOINT, DEFAULT_BATCH_SIZE, DEFAULT_FLUSH_INTERVAL_MS, DEFAULT_MAX_RETRIES, DEFAULT_TIMEOUT_MS } from "./config.constants.js";

export function resolveOptions(options: SoonwhyOptions): ResolvedOptions {
  if (!options.apiKey.trim()) throw new Error("Soonwhy apiKey is required");

  const endpoint = normalizeEndpoint(options.endpoint ?? DEFAULT_ENDPOINT);
  if (!/^https?:\/\//i.test(endpoint)) {
    throw new Error("Soonwhy endpoint must use http or https");
  }

  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("Soonwhy batchSize must be a positive integer");
  }

  const flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
  if (!Number.isFinite(flushIntervalMs) || flushIntervalMs < 0) {
    throw new Error("Soonwhy flushIntervalMs must be a non-negative number");
  }

  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new Error("Soonwhy maxRetries must be a non-negative integer");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Soonwhy timeoutMs must be a positive number");
  }

  return {
    apiKey: options.apiKey,
    endpoint,
    batchSize,
    flushIntervalMs,
    maxRetries,
    timeoutMs,
    registerShutdownHandlers: options.registerShutdownHandlers ?? true,
    fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
    sleep:
      options.sleep ??
      ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs))),
    redactSensitiveData: true,
    maxAttributeCount:
      options.maxAttributeCount ?? DEFAULT_SECURITY_OPTIONS.maxAttributeCount,
    maxAttributeValueLength:
      options.maxAttributeValueLength ??
      DEFAULT_SECURITY_OPTIONS.maxAttributeValueLength,
  };
}

function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed) throw new Error("Soonwhy endpoint is required");
  return trimmed.replace(/\/+$/, "");
}
