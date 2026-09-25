import { describe, expect, it } from 'vitest';
import { buildInstrumentationConfig, supportedInstrumentations } from './instrumentation.js';

describe('Node SDK validation matrix', () => {
  it('covers the required application and dependency instrumentations', () => {
    expect(supportedInstrumentations()).toEqual([
      'http',
      'express',
      'nestjs',
      'postgres',
      'redis',
      'ioredis',
    ]);
  });

  it('keeps database statement capture constrained', () => {
    const config = buildInstrumentationConfig({
      http: true,
      express: true,
      nestjs: true,
      postgres: true,
      redis: true,
      ioredis: true,
    });

    expect(config['@opentelemetry/instrumentation-pg']).toMatchObject({
      enabled: true,
      enhancedDatabaseReporting: false,
    });

    expect(config['@opentelemetry/instrumentation-redis']?.enabled).toBe(true);
    expect(config['@opentelemetry/instrumentation-ioredis']?.enabled).toBe(true);

    const redisSerializer = config['@opentelemetry/instrumentation-redis']
      ?.dbStatementSerializer as ((command: string, ...args: unknown[]) => string);
    const ioredisSerializer = config['@opentelemetry/instrumentation-ioredis']
      ?.dbStatementSerializer as ((command: string, ...args: unknown[]) => string);

    expect(redisSerializer('GET', 'secret-value')).toBe('GET');
    expect(ioredisSerializer('SET', 'password', 'secret-value')).toBe('SET');
  });

  it('allows dependency instrumentation to be disabled independently', () => {
    const config = buildInstrumentationConfig({
      http: true,
      express: false,
      nestjs: false,
      postgres: false,
      redis: true,
      ioredis: false,
    });

    expect(config['@opentelemetry/instrumentation-http']?.enabled).toBe(true);
    expect(config['@opentelemetry/instrumentation-express']?.enabled).toBe(false);
    expect(config['@opentelemetry/instrumentation-nestjs-core']?.enabled).toBe(false);
    expect(config['@opentelemetry/instrumentation-pg']?.enabled).toBe(false);
    expect(config['@opentelemetry/instrumentation-redis']?.enabled).toBe(true);
    expect(config['@opentelemetry/instrumentation-ioredis']?.enabled).toBe(false);
  });
});
