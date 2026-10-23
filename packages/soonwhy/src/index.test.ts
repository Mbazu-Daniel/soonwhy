import { describe, expect, it } from 'vitest';
import { snapshotTimestamp } from './index.js';

describe('snapshotTimestamp', () => {
  it('formats timestamps for snapshot package versions', () => {
    expect(snapshotTimestamp(new Date('2026-09-26T12:34:56.000Z'))).toBe(
      '20260926T123456Z',
    );
  });
});
