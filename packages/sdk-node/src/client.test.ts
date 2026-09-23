import { describe, expect, it } from 'vitest';
import { hasSupportedInstrumentation } from './instrumentation.js';
import { resolveNodeOptions } from './config.js';

describe('@soonwhy/sdk-node', () => {
  it('validates the service identity and API key', () => {
    expect(() => resolveNodeOptions({
      apiKey: ' ',
      serviceName: 'api',
    })).toThrow('apiKey is required');

    expect(() => resolveNodeOptions({
      apiKey: 'sk_test',
      serviceName: ' ',
    })).toThrow('serviceName is required');
  });

  it('normalizes the ingestion endpoint and validates sampling', () => {
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

  it('does not expose the API key through resolved diagnostics', () => {
    const options = resolveNodeOptions({
      apiKey: 'super-secret',
      serviceName: 'api',
    });

    expect(JSON.stringify({
      endpoint: options.endpoint,
      serviceName: options.serviceName,
      sampling: options.sampling,
    })).not.toContain('super-secret');
  });

  it('limits the supported instrumentation surface to the first Node workloads', () => {
    expect(hasSupportedInstrumentation('http')).toBe(true);
    expect(hasSupportedInstrumentation('express')).toBe(true);
    expect(hasSupportedInstrumentation('nestjs-core')).toBe(true);
    expect(hasSupportedInstrumentation('pg')).toBe(true);
    expect(hasSupportedInstrumentation('redis')).toBe(true);
    expect(hasSupportedInstrumentation('ioredis')).toBe(true);
    expect(hasSupportedInstrumentation('mongodb')).toBe(false);
  });
});
