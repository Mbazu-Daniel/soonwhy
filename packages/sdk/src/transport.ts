import type { ResolvedOptions } from './config.js';

export type Signal = 'logs' | 'metrics';

export interface TelemetryTransport {
  send(signal: Signal, payload: unknown): Promise<boolean>;
}

export class HttpTelemetryTransport implements TelemetryTransport {
  constructor(private readonly options: ResolvedOptions) {}

  async send(signal: Signal, payload: unknown): Promise<boolean> {
    const url = `${this.options.endpoint}/${signal}`;
    let attempt = 0;

    while (true) {
      try {
        const response = await this.options.fetch(url, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.options.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) return true;
        if (!isRetryableStatus(response.status) || attempt >= this.options.maxRetries) return false;
      } catch {
        if (attempt >= this.options.maxRetries) return false;
      }

      const delayMs = 1_000 * 2 ** attempt;
      attempt += 1;
      await this.options.sleep(delayMs);
    }
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}
