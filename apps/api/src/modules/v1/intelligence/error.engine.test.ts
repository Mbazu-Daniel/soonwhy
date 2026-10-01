import { describe, expect, it } from 'vitest';
import { evaluateErrorSignal, fingerprintError, type ErrorEvent } from './error.engine';

const event: ErrorEvent = {
  serviceName: 'api',
  endpoint: 'GET /users',
  traceId: 'trace-1',
  timestamp: '2026-09-28T10:00:00.000Z',
  exceptionType: 'TypeError',
  message: 'User 123 failed for request 550e8400-e29b-41d4-a716-446655440000',
  stack: 'TypeError: failed\n    at loadUser (/app/src/users.ts:42:9)\n    at process (/app/node_modules/framework/index.js:10:2)',
};

describe('error intelligence engine', () => {
  it('keeps stable identity while removing volatile message values', () => {
    const first = fingerprintError(event);
    const second = fingerprintError({ ...event, message: 'User 987 failed for request 123e4567-e89b-12d3-a456-426614174000' });

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.normalizedMessage).toContain('<number>');
    expect(first.stackFrame).toContain('/app/src/users.ts');
  });

  it('detects an elevated error rate', () => {
    const signal = evaluateErrorSignal(
      [event],
      {
        errorCount: 20,
        requestCount: 200,
        affectedTraceCount: 18,
        firstSeenAt: event.timestamp,
        lastSeenAt: event.timestamp,
      },
    );

    expect(signal?.severity).toBe('warning');
    expect(signal?.errorRate).toBe(0.1);
    expect(signal?.fingerprint).toHaveLength(24);
  });

  it('detects a severe error spike against a baseline', () => {
    const signal = evaluateErrorSignal(
      [event],
      {
        errorCount: 100,
        requestCount: 500,
        affectedTraceCount: 80,
        firstSeenAt: event.timestamp,
        lastSeenAt: event.timestamp,
      },
      { errorCount: 10, requestCount: 500 },
    );

    expect(signal?.severity).toBe('critical');
    expect(signal?.errorRateChangePercent).toBe(900);
    expect(signal?.countChangePercent).toBe(900);
  });

  it('does not create a signal from a healthy window', () => {
    expect(
      evaluateErrorSignal(
        [event],
        {
          errorCount: 2,
          requestCount: 1_000,
          affectedTraceCount: 2,
          firstSeenAt: event.timestamp,
          lastSeenAt: event.timestamp,
        },
      ),
    ).toBeUndefined();
  });
});
