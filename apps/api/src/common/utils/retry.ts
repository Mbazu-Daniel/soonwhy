export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  retryableErrors?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

const defaultRetryOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: () => true,
  onRetry: () => {},
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...defaultRetryOptions, ...options };
  let lastError: any;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxAttempts || !opts.retryableErrors(error)) {
        throw error;
      }

      opts.onRetry(attempt, error);

      if (opts.jitter) {
        delay = delay * (0.5 + Math.random());
      }

      await sleep(Math.min(delay, opts.maxDelayMs));
      delay = delay * opts.backoffMultiplier;
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableError(error: any): boolean {
  if (!error) return false;

  const errorStr = String(error).toLowerCase();

  const retryablePatterns = [
    "timeout",
    "etimedout",
    "econnrefused",
    "econnreset",
    "enotfound",
    "econnaborted",
    "enetwork",
    "5xx",
    "rate limit",
    "too many requests",
    "temporary",
    "unavailable",
  ];

  return retryablePatterns.some((pattern) => errorStr.includes(pattern));
}

export function isNonRetryableError(error: any): boolean {
  if (!error) return false;

  const errorStr = String(error).toLowerCase();

  const nonRetryablePatterns = [
    "validation",
    "unauthorized",
    "forbidden",
    "not found",
    "404",
    "401",
    "403",
    "conflict",
    "409",
    "bad request",
    "400",
  ];

  return nonRetryablePatterns.some((pattern) => errorStr.includes(pattern));
}
