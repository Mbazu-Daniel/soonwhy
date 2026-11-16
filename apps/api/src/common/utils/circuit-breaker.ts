export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeoutMs?: number;
  resetTimeoutMs?: number;
  onStateChange?: (state: CircuitState) => void;
}

export type CircuitState = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;
  private halfOpenProbeInFlight = false;

  constructor(private readonly options: CircuitBreakerOptions = {}) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error("Circuit breaker is OPEN");
      }
      this.transitionTo("half-open");
    }

    if (this.state === "half-open") {
      if (this.halfOpenProbeInFlight) {
        throw new Error("Circuit breaker is HALF-OPEN; a probe is already in flight");
      }
      this.halfOpenProbeInFlight = true;
    }

    try {
      const result = await this.withTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    } finally {
      this.halfOpenProbeInFlight = false;
    }
  }

  private async withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    const timeoutMs = this.options.timeoutMs;
    if (!timeoutMs || timeoutMs <= 0) return fn();

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Circuit breaker timeout after ${timeoutMs}ms`)),
            timeoutMs,
          );
          timer.unref?.();
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === "half-open") {
      this.successCount++;
      const threshold = this.options.successThreshold || 2;
      if (this.successCount >= threshold) {
        this.transitionTo("closed");
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;
    this.lastFailureTime = Date.now();

    const threshold = this.options.failureThreshold || 5;
    if (this.failureCount >= threshold) {
      const resetTimeout = this.options.resetTimeoutMs || 60000;
      this.nextAttemptTime = Date.now() + resetTimeout;
      this.transitionTo("open");
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.options.onStateChange?.(newState);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
  }
}
