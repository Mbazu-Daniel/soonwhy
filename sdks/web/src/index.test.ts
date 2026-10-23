import { describe, expect, it } from 'vitest';
import { SoonwhyWeb } from './index.js';

describe('SoonwhyWeb', () => {
  it('validates required options', () => {
    expect(() => new SoonwhyWeb({ apiKey: ' ', flushIntervalMs: 0 })).toThrow('apiKey');
    expect(() => new SoonwhyWeb({ apiKey: 'key', endpoint: 'ftp://localhost', flushIntervalMs: 0 })).toThrow(
      'endpoint',
    );
    expect(() => new SoonwhyWeb({ apiKey: 'key', batchSize: 0, flushIntervalMs: 0 })).toThrow('batchSize');
  });

  it('accepts service metadata and closes without pending telemetry', async () => {
    const sdk = new SoonwhyWeb({
      apiKey: 'key',
      serviceName: 'web-app',
      serviceVersion: '1.0.0',
      deploymentEnvironment: 'production',
      attributes: { team: 'platform' },
      flushIntervalMs: 0,
    });

    expect(await sdk.close()).toEqual({ sent: 0, dropped: 0 });
  });
});
