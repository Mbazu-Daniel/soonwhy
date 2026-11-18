import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logWindow, refreshMs } from './log-range';

vi.mock('~/components/telemetry/time-range-control', () => ({
  telemetryRangeParams: (range: string) => ({ from: 'preset-from-' + range, to: 'preset-to' }),
}));

describe('refreshMs', () => {
  it('maps an option to its interval', () => {
    expect(refreshMs('5')).toBe(5_000);
    expect(refreshMs('60')).toBe(60_000);
  });

  it('is off for off or an unknown value', () => {
    expect(refreshMs('off')).toBe(false);
    expect(refreshMs('7')).toBe(false);
  });
});

describe('logWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-18T12:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('covers all time up to now', () => {
    expect(logWindow('all', '', '')).toEqual({ from: '1970-01-01T00:00:00.000Z', to: '2026-11-18T12:00:00.000Z' });
  });

  it('delegates a preset range to the time range control', () => {
    expect(logWindow('1h' as never, '', '')).toEqual({ from: 'preset-from-1h', to: 'preset-to' });
  });

  it('uses the chosen custom bounds', () => {
    expect(logWindow('custom', '2026-11-01T00:00:00.000Z', '2026-11-02T00:00:00.000Z')).toEqual({
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-02T00:00:00.000Z',
    });
  });

  it('defaults a custom window to the last hour', () => {
    expect(logWindow('custom', '', '')).toEqual({ from: '2026-11-18T11:00:00.000Z', to: '2026-11-18T12:00:00.000Z' });
  });
});
