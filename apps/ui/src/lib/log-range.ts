import { telemetryRangeParams, type TelemetryRange } from '~/components/telemetry/time-range-control';

export type LogRange = TelemetryRange | 'custom' | 'all';

export const REFRESH_OPTIONS = [
  { value: 'off', label: 'Refresh off', ms: false },
  { value: '5', label: 'Every 5s', ms: 5_000 },
  { value: '10', label: 'Every 10s', ms: 10_000 },
  { value: '30', label: 'Every 30s', ms: 30_000 },
  { value: '60', label: 'Every 60s', ms: 60_000 },
] as const;

export function refreshMs(value: string): number | false {
  return REFRESH_OPTIONS.find((item) => item.value === value)?.ms ?? false;
}

export function logWindow(range: LogRange, customFrom: string, customTo: string): { from: string; to: string } {
  if (range === 'all') return { from: new Date(0).toISOString(), to: new Date().toISOString() };
  if (range === 'custom') {
    return {
      from: customFrom ? new Date(customFrom).toISOString() : new Date(Date.now() - 3_600_000).toISOString(),
      to: customTo ? new Date(customTo).toISOString() : new Date().toISOString(),
    };
  }
  return telemetryRangeParams(range);
}
