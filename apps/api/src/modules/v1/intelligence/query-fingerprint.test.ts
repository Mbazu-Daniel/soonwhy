import { describe, expect, it } from 'vitest';
import { canonicalizeQuery, fingerprintQuery } from './query-fingerprint';

describe('query fingerprinting', () => {
  it('normalizes literal values into the same query shape', () => {
    const first = fingerprintQuery("SELECT * FROM users WHERE id = 123");
    const second = fingerprintQuery("SELECT * FROM users WHERE id = 987");

    expect(first.identity.fingerprint).toBe(second.identity.fingerprint);
    expect(first.identity.operation).toBe(second.identity.operation);
  });

  it('normalizes IN-list values without using list size as identity', () => {
    const first = fingerprintQuery("SELECT * FROM users WHERE id IN (1, 2)");
    const second = fingerprintQuery("SELECT * FROM users WHERE id IN (1, 2, 3, 4, 5)");

    expect(first.identity.fingerprint).toBe(second.identity.fingerprint);
    expect(first.evidence.listCardinalities).toEqual([2]);
    expect(second.evidence.listCardinalities).toEqual([5]);
  });

  it('preserves the raw query as evidence', () => {
    const result = fingerprintQuery("SELECT * FROM users WHERE id = 123");

    expect(result.evidence.rawQuery).toBe("SELECT * FROM users WHERE id = 123");
  });

  it('normalizes whitespace and SQL keyword casing', () => {
    const first = fingerprintQuery('SELECT  *  FROM users WHERE id = 1');
    const second = fingerprintQuery('select * from users where id = 2');

    expect(first.identity.fingerprint).toBe(second.identity.fingerprint);
  });

  it('keeps materially different query shapes separate', () => {
    const first = fingerprintQuery('SELECT * FROM users WHERE id = 1');
    const second = fingerprintQuery('SELECT * FROM orders WHERE id = 1');

    expect(first.identity.fingerprint).not.toBe(second.identity.fingerprint);
  });

  it('keeps database system in the fingerprint context', () => {
    const postgres = fingerprintQuery('SELECT * FROM users WHERE id = 1', 'postgresql');
    const mysql = fingerprintQuery('SELECT * FROM users WHERE id = 1', 'mysql');

    expect(postgres.identity.fingerprint).not.toBe(mysql.identity.fingerprint);
  });

  it('strips line and block comments before identity generation', () => {
    const first = canonicalizeQuery('SELECT * FROM users -- lookup\nWHERE id = 1');
    const second = canonicalizeQuery('SELECT * FROM users WHERE id = 2 /* lookup */');

    expect(first.operation).toBe(second.operation);
  });

  it('does not make empty input crash', () => {
    const result = fingerprintQuery('');

    expect(result.identity.operation).toBe('');
    expect(result.evidence.listCardinalities).toEqual([]);
  });
});
