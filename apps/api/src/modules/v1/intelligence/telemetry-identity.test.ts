import { describe, expect, it } from 'vitest';
import { createTelemetryIdentity, fingerprintCanonicalValue } from './telemetry-identity';

describe('telemetry identity', () => {
  it('produces the same fingerprint when object keys arrive in a different order', () => {
    const first = fingerprintCanonicalValue({
      service: 'checkout',
      database: { system: 'postgresql', host: 'db-1' },
    });
    const second = fingerprintCanonicalValue({
      database: { host: 'db-1', system: 'postgresql' },
      service: 'checkout',
    });

    expect(first).toBe(second);
  });

  it('keeps array order significant', () => {
    const first = fingerprintCanonicalValue({ values: ['a', 'b'] });
    const second = fingerprintCanonicalValue({ values: ['b', 'a'] });

    expect(first).not.toBe(second);
  });

  it('keeps fingerprint version explicit on every identity', () => {
    const identity = createTelemetryIdentity({
      domain: 'database',
      serviceName: 'checkout',
      operationName: 'SELECT users',
      databaseSystem: 'postgresql',
    });

    expect(identity.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(identity.fingerprintVersion).toBe(1);
    expect(identity.domain).toBe('database');
  });

  it('changes identity when an explicit identity attribute changes', () => {
    const first = createTelemetryIdentity({
      domain: 'database',
      serviceName: 'checkout',
      operationName: 'SELECT users',
      identityAttributes: { database: 'primary' },
    });
    const second = createTelemetryIdentity({
      domain: 'database',
      serviceName: 'checkout',
      operationName: 'SELECT users',
      identityAttributes: { database: 'replica' },
    });

    expect(first.fingerprint).not.toBe(second.fingerprint);
  });

  it('keeps equivalent database operations stable', () => {
    const first = createTelemetryIdentity({
      domain: 'database',
      serviceName: 'checkout',
      operationName: 'SELECT * FROM users WHERE id = ?',
    });
    const second = createTelemetryIdentity({
      domain: 'database',
      serviceName: 'checkout',
      operationName: 'SELECT * FROM users WHERE id = ?',
    });

    expect(first.fingerprint).toBe(second.fingerprint);
  });
});
