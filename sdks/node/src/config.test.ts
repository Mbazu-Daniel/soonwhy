import { describe, expect, it } from 'vitest';
import { resolveNodeOptions } from './config.js';

describe('resolveNodeOptions', () => {
  it('applies safe defaults', () => {
    const options = resolveNodeOptions({
      apiKey: 'key',
      serviceName: 'payments',
    });

    expect(options.endpoint).toBe('http://localhost:3002/v1');
    expect(options.timeoutMs).toBe(10_000);
    expect(options.sampling).toEqual({ type: 'always_on' });
    expect(options.registerShutdownHandlers).toBe(true);
    expect(options.instrumentations).toEqual({
      http: true,
      express: true,
      nestjs: true,
      postgres: true,
      redis: true,
      ioredis: true,
    });
  });

  it('rejects an invalid sampling ratio', () => {
    expect(() =>
      resolveNodeOptions({
        apiKey: 'key',
        serviceName: 'payments',
        sampling: { type: 'ratio', ratio: 2 },
      }),
    ).toThrow('sampling ratio');
  });

  it('rejects empty credentials', () => {
    expect(() =>
      resolveNodeOptions({
        apiKey: ' ',
        serviceName: 'payments',
      }),
    ).toThrow('apiKey');

    expect(() =>
      resolveNodeOptions({
        apiKey: 'key',
        serviceName: ' ',
      }),
    ).toThrow('serviceName');
  });
});
