import { afterEach, describe, expect, it, vi } from 'vitest';
import { init } from './client.js';
import type { SoonwhyOptions } from './types.js';

afterEach(() => vi.restoreAllMocks());

function options(overrides: Partial<SoonwhyOptions> = {}): SoonwhyOptions {
  return {
    apiKey: 'sk_test',
    endpoint: 'http://localhost:3002/v1',
    flushIntervalMs: 0,
    registerShutdownHandlers: false,
    ...overrides,
  };
}

describe('Soonwhy SDK foundation', () => {
  it('validates required configuration', () => {
    expect(() => init(options({ apiKey: ' ' }))).toThrow('apiKey is required');
    expect(() => init(options({ endpoint: 'ftp://localhost/v1' }))).toThrow(
      'endpoint must use http or https',
    );
  });

  it('batches manual telemetry and sends OTLP JSON', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const client = init(options({ batchSize: 2, fetch }));

    client.captureLog({ level: 'info', message: 'started' });
    client.captureMetric({ name: 'queue.depth', value: 4, unit: 'items' });

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    const logCall = fetch.mock.calls.find(([url]) => String(url).endsWith('/logs'));
    const logBody = JSON.parse(String(logCall?.[1]?.body));
    expect(logBody.resourceLogs[0].scopeLogs[0].logRecords[0].body.stringValue).toBe('started');

    const metricCall = fetch.mock.calls.find(([url]) => String(url).endsWith('/metrics'));
    const metricBody = JSON.parse(String(metricCall?.[1]?.body));
    expect(metricBody.resourceMetrics[0].scopeMetrics[0].metrics[0].gauge.dataPoints[0].asDouble).toBe(4);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3002/v1/logs',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer sk_test',
          'content-type': 'application/json',
        }),
      }),
    );

    await client.close();
  });

  it('retries transient failures and fails open', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn().mockRejectedValue(new Error('offline'));
    const client = init(options({ maxRetries: 2, sleep, fetch }));

    client.captureLog({ message: 'offline event' });
    const result = await client.flush();

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2000);
    expect(result).toEqual({ sent: 0, dropped: 1 });

    await client.close();
  });

  it('flushes on close and ignores later captures', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const client = init(options({ fetch }));

    client.captureError({ error: new Error('boom') });
    const result = await client.close();
    client.captureLog({ message: 'ignored' });

    expect(result).toEqual({ sent: 1, dropped: 0 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(client.getStats().queued).toBe(0);
  });
});
