export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeoutMs?: number;
  resetTimeoutMs?: number;
  onStateChange?: (state: CircuitState) => void;
}

export type CircuitState = "closed" | "open" | "half-open";
