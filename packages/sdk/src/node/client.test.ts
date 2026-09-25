import { describe, expect, it } from 'vitest';
import { resolveNodeOptions } from './config.js';
import { supportedInstrumentations } from './instrumentation.js';

describe('Soonwhy Node SDK', () => {
  it('requires an API key and service name', () => {
    expect(() => resolveNodeOptions({
      apiKey: ' ',
      serviceName: 'api',
    })).toThrow('apiKey is required');

    expect(() => resolveNodeOptions({
      apiKey: 'sk_test',
      serviceName: ' ',
    })).toThrow('serviceName is required');
  });

  it('normalizes the endpoint and validates sampling', () => {
    const options = resolveNodeOptions({
      apiKey: 'sk_test',
      serviceName: 'api',
      endpoint: 'https://ingest.example.test/v1///',
      sampling: { type: 'ratio', ratio: 0.25 },
    });

    expect(options.endpoint).toBe('https://ingest.example.test/v1');
    expect(options.sampling).toEqual({ type: 'ratio', ratio: 0.25 });
  });

  it('rejects invalid sampling ratios', () => {
    expect(() => resolveNodeOptions({
      apiKey: 'sk_test',
      serviceName: 'api',
      sampling: { type: 'ratio', ratio: 2 },
    })).toThrow('sampling ratio');
  });

  it('does not expose the API key through public configuration output', () => {
    const options = resolveNodeOptions({
      apiKey: 'super-secret',
      serviceName: 'api',
    });

    const diagnostics = {
      endpoint: options.endpoint,
      serviceName: options.serviceName,
      environment: options.environment,
      sampling: options.sampling,
    };

    expect(JSON.stringify(diagnostics)).not.toContain('super-secret');
  });

  it('supports the initial Node instrumentation set', () => {
    expect(supportedInstrumentations()).toEqual([
      'http',
      'express',
      'nestjs',
      'postgres',
      'redis',
      'ioredis',
    ]);
  });
});
