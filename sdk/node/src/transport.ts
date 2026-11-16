import type { ResolvedOptions } from "./config.js";

export type Signal = "logs" | "metrics";
export interface TelemetryTransport {
  send(signal: Signal, payload: Record<string, unknown>): Promise<boolean>;
}

export class HttpTelemetryTransport implements TelemetryTransport {
  constructor(private readonly options: ResolvedOptions) {}

  async send(signal: Signal, payload: Record<string, unknown>): Promise<boolean> {
    const url = `${this.options.endpoint}/${signal}`;
    let attempt = 0;
    let retryAfterMs: number | undefined;

    while (true) {
      try {
        const response = await this.options.fetch(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.options.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.options.timeoutMs),
        });

        if (response.ok) return true;
        if (
          !isRetryableStatus(response.status) ||
          attempt >= this.options.maxRetries
        )
          return false;
        retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      } catch {
        if (attempt >= this.options.maxRetries) return false;
      }

      const delayMs =
        retryAfterMs ??
        Math.round(Math.random() * Math.min(30_000, 1_000 * 2 ** attempt));
      retryAfterMs = undefined;
      attempt += 1;
      await this.options.sleep(delayMs);
    }
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.round(seconds * 1000), 60_000);
  }
  const date = Date.parse(value);
  if (!Number.isNaN(date)) {
    const delay = date - Date.now();
    return delay > 0 ? Math.min(Math.round(delay), 60_000) : undefined;
  }
  return undefined;
}
