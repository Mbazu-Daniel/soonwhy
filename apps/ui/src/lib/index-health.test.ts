import { describe, expect, it } from 'vitest';
import { formatAge, formatBytes } from './index-health';

describe('formatBytes', () => {
  it('scales units and handles empty values', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(66219)).toBe('65 KB');
    expect(formatBytes(5 * 1024 ** 3)).toBe('5.0 GB');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});

describe('formatAge', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  it('shows the largest whole unit, and never for missing data', () => {
    expect(formatAge(null, now)).toBe('never');
    expect(formatAge('2026-11-14T11:59:30Z', now)).toBe('30s ago');
    expect(formatAge('2026-11-14T11:15:00Z', now)).toBe('45m ago');
    expect(formatAge('2026-11-14T09:00:00Z', now)).toBe('3h ago');
    expect(formatAge('2026-11-10T12:00:00Z', now)).toBe('4d ago');
  });
});
