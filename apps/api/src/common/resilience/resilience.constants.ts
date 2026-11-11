import type { ResiliencePreset } from "@nestjs/resilience";
import type { ResiliencePresetName } from "./resilience.types";

export const RESILIENCE_PRESETS: Record<ResiliencePresetName, ResiliencePreset> = {
  webhook: {
    retry: {
      attempts: 3,
      backoff: { delay: "250ms", factor: 2, maxDelay: "2s" },
    },
    timeout: "10s",
    circuitBreaker: {
      failureRateThreshold: 50,
      minimumCalls: 5,
      slidingWindow: { type: "count", size: 10 },
      openDuration: "30s",
      halfOpenMaxCalls: 1,
    },
  },
  slack: {
    retry: {
      attempts: 3,
      backoff: { delay: "250ms", factor: 2, maxDelay: "2s" },
    },
    timeout: "10s",
    circuitBreaker: {
      failureRateThreshold: 50,
      minimumCalls: 5,
      slidingWindow: { type: "count", size: 10 },
      openDuration: "30s",
      halfOpenMaxCalls: 1,
    },
  },
  email: {
    retry: {
      attempts: 3,
      backoff: { delay: "500ms", factor: 2, maxDelay: "5s" },
    },
    timeout: "15s",
    circuitBreaker: {
      failureRateThreshold: 50,
      minimumCalls: 5,
      slidingWindow: { type: "count", size: 10 },
      openDuration: "60s",
      halfOpenMaxCalls: 1,
    },
  },
  probe: {
    retry: {
      attempts: 2,
      backoff: { delay: "200ms", factor: 1 },
    },
    timeout: "10s",
    circuitBreaker: {
      failureRateThreshold: 50,
      minimumCalls: 10,
      slidingWindow: { type: "count", size: 20 },
      openDuration: "15s",
      halfOpenMaxCalls: 1,
    },
  },
};

export const RETRYABLE_HTTP_STATUSES = new Set([408, 429]);

export const RETRYABLE_HTTP_STATUS_FLOOR = 500;
