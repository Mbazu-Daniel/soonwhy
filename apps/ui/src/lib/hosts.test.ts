import { describe, expect, it } from 'vitest';
import { hostStatus } from './hosts';

const NOW = Date.parse('2026-11-17T12:00:00.000Z');

describe('hostStatus', () => {
  it('is reporting when seen in the last five minutes', () => {
    expect(hostStatus({ lastSeenAt: '2026-11-17T11:57:00.000Z' }, NOW)).toBe('reporting');
  });

  it('is quiet after five minutes without data', () => {
    expect(hostStatus({ lastSeenAt: '2026-11-17T11:50:00.000Z' }, NOW)).toBe('quiet');
  });

  it('is quiet when the time is unreadable', () => {
    expect(hostStatus({ lastSeenAt: 'nope' }, NOW)).toBe('quiet');
  });
});
