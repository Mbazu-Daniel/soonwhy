import { describe, expect, it } from 'vitest';
import { sanitizeRequestUrl } from './detection.utils';

describe('sanitizeRequestUrl', () => {
  it('removes query parameters from absolute URLs', () => {
    expect(sanitizeRequestUrl('https://api.example.com/users?api_key=secret&sig=abc')).toBe('/users');
  });

  it('removes query parameters from relative URLs', () => {
    expect(sanitizeRequestUrl('/users?api_key=secret')).toBe('/users');
  });

  it('removes fragments from URLs', () => {
    expect(sanitizeRequestUrl('/users#secret')).toBe('/users');
  });
});
