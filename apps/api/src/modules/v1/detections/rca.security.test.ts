import { describe, expect, it } from 'vitest';
import { sanitizeRcaContext, sanitizeRcaValue } from './rca.security';

describe('RCA security sanitization', () => {
  it('redacts sensitive keys recursively', () => {
    expect(sanitizeRcaContext({
      authorization: 'Bearer secret',
      nested: {
        password: 'secret',
        safe: 'value',
      },
    })).toEqual({
      authorization: '[redacted]',
      nested: {
        password: '[redacted]',
        safe: 'value',
      },
    });
  });

  it('removes query strings and fragments from URLs', () => {
    expect(sanitizeRcaValue(
      'https://example.test/orders?id=123&token=secret#details',
    )).toBe('https://example.test/orders');
  });

  it('bounds long telemetry strings', () => {
    const result = String(sanitizeRcaValue('x'.repeat(600)));
    expect(result.length).toBe(501);
    expect(result.endsWith('…')).toBe(true);
  });

  it('redacts common body and credential fields', () => {
    expect(sanitizeRcaContext({
      'request.body': { email: 'person@example.com' },
      'response.body': { card_number: '4111111111111111' },
      api_key: 'secret',
    })).toEqual({
      'request.body': '[redacted]',
      'response.body': '[redacted]',
      api_key: '[redacted]',
    });
  });
});
