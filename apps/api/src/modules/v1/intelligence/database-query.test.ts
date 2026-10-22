import { describe, expect, it } from 'vitest';
import { createDatabaseQueryObservation } from './database-query';

describe('database query observation', () => {
  it('keeps endpoint and latency as evidence rather than query identity', () => {
    const first = createDatabaseQueryObservation({
      query: 'SELECT * FROM users WHERE id = 1',
      serviceName: 'api',
      endpoint: 'GET /users',
      observedAt: '2026-09-28T00:00:00.000Z',
      durationMs: 40,
    });
    const second = createDatabaseQueryObservation({
      query: 'SELECT * FROM users WHERE id = 2',
      serviceName: 'api',
      endpoint: 'GET /admin/users',
      observedAt: '2026-09-28T00:00:01.000Z',
      durationMs: 400,
    });

    expect(first.identity.fingerprint).toBe(second.identity.fingerprint);
    expect(first.observations).toHaveLength(2);
    expect(second.observations).toHaveLength(2);
  });
});
