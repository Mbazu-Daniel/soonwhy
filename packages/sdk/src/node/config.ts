import type { NodeSdkOptions, NodeSampling } from "./types.js";

export const DEFAULT_ENDPOINT = "http://localhost:3002/api/v1";
export const DEFAULT_TIMEOUT_MS = 10_000;

export interface ResolvedNodeSdkOptions
  extends Omit<NodeSdkOptions, "sampling"> {
  endpoint: string;
  timeoutMs: number;
  sampling: NodeSampling;
  registerShutdownHandlers: boolean;
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

export function resolveNodeOptions(
  options: NodeSdkOptions,
): ResolvedNodeSdkOptions {
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new Error("Soonwhy Node SDK apiKey is required");

  const serviceName = options.serviceName.trim();
  if (!serviceName) throw new Error("Soonwhy Node SDK serviceName is required");

  const endpoint = normalizeEndpoint(options.endpoint ?? DEFAULT_ENDPOINT);
  if (!/^https?:\/\//i.test(endpoint)) {
    throw new Error("Soonwhy Node SDK endpoint must use http or https");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Soonwhy Node SDK timeoutMs must be a positive number");
  }

  const batchSize = options.batchSize ?? 100;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("Soonwhy Node SDK batchSize must be a positive integer");
  }

  const flushIntervalMs = options.flushIntervalMs ?? 5000;
  if (!Number.isFinite(flushIntervalMs) || flushIntervalMs < 0) {
    throw new Error(
      "Soonwhy Node SDK flushIntervalMs must be a non-negative number",
    );
  }

  const maxRetries = options.maxRetries ?? 3;
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new Error(
      "Soonwhy Node SDK maxRetries must be a non-negative integer",
    );
  }

  const fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const sleep =
    options.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)));

  const redactSensitiveData = options.redactSensitiveData ?? true;
  const maxAttributeCount = options.maxAttributeCount ?? 100;
  const maxAttributeValueLength = options.maxAttributeValueLength ?? 4096;

  const sampling = resolveSampling(options.sampling);

  return {
    ...options,
    apiKey,
    serviceName,
    endpoint,
    timeoutMs,
    sampling,
    registerShutdownHandlers: options.registerShutdownHandlers ?? true,
    instrumentations: {
      http: options.instrumentations?.http ?? true,
      express: options.instrumentations?.express ?? true,
      nestjs: options.instrumentations?.nestjs ?? true,
      postgres: options.instrumentations?.postgres ?? true,
      redis: options.instrumentations?.redis ?? true,
      ioredis: options.instrumentations?.ioredis ?? true,
    },
    batchSize,
    flushIntervalMs,
    maxRetries,
    fetch,
    sleep,
    redactSensitiveData,
    maxAttributeCount,
    maxAttributeValueLength,
  };
}

function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed) throw new Error("Soonwhy Node SDK endpoint is required");
  return trimmed.replace(/\/+$/, "");
}

function resolveSampling(sampling: NodeSampling | undefined): NodeSampling {
  if (!sampling) return { type: "always_on" };
  if (sampling.type !== "ratio") return sampling;

  if (
    !Number.isFinite(sampling.ratio) ||
    sampling.ratio < 0 ||
    sampling.ratio > 1
  ) {
    throw new Error("Soonwhy Node SDK sampling ratio must be between 0 and 1");
  }

  return sampling;
}
