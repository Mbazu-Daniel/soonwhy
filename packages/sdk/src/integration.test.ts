import { describe, expect, it, vi } from 'vitest';
import { init } from './index.js';

describe('Soonwhy SDK ingestion integration', () => {
  it('sends application telemetry through the SDK to the ingestion endpoint', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response('{}', { status: 200 }),
    );

    const client = init({
      apiKey: 'sk_test_integration',
      endpoint: 'http://ingest.test/v1',
      serviceName: 'express-example',
      batchSize: 10,
      flushIntervalMs: 0,
      fetch,
      sleep: async () => undefined,
      registerShutdownHandlers: false,
    });

    client.captureLog({
      level: 'error',
      message: 'request failed',
      attributes: { route: '/checkout', dependency: 'postgres' },
    });
    client.captureMetric({
      name: 'request.latency',
      value: 240,
      unit: 'ms',
    });

    await expect(client.flush()).resolves.toEqual({ sent: 2, dropped: 0 });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'http://ingest.test/v1/logs',
      'http://ingest.test/v1/metrics',
    ]);

    for (const [url, request] of fetch.mock.calls) {
      expect(url).toContain('/v1/');
      expect(request?.headers).toMatchObject({
        authorization: 'Bearer sk_test_integration',
        'content-type': 'application/json',
      });
    }

    await client.close();
  });

  it('fails open after retryable ingestion failures', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response('temporary failure', { status: 503 }));

    const sleep = vi.fn(async () => undefined);
    const client = init({
      apiKey: 'sk_test_failure',
      endpoint: 'http://ingest.test/v1',
      serviceName: 'failure-example',
      maxRetries: 2,
      flushIntervalMs: 0,
      fetch,
      sleep,
      registerShutdownHandlers: false,
    });

    client.captureLog({ message: 'dependency timeout' });

    await expect(client.flush()).resolves.toEqual({ sent: 0, dropped: 1 });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(client.getStats()).toEqual({ queued: 0, sent: 0, dropped: 1 });

    await client.close();
  });

  it('preserves the application path when ingestion is slow', async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(
      () => new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      }),
    );

    const client = init({
      apiKey: 'sk_test_latency',
      endpoint: 'http://ingest.test/v1',
      serviceName: 'latency-example',
      flushIntervalMs: 0,
      fetch,
      sleep: async () => undefined,
      registerShutdownHandlers: false,
    });

    client.captureMetric({ name: 'request.latency', value: 900, unit: 'ms' });
    const flush = client.flush();

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(client.getStats().queued).toBe(0);

    resolveResponse?.(new Response('{}', { status: 200 }));
    await expect(flush).resolves.toEqual({ sent: 1, dropped: 0 });

    await client.close();
  });
});
