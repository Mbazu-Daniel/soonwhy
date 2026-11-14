const SIX_HOURS = 6 * 60 * 60 * 1000;
const TWO_DAYS = 48 * 60 * 60 * 1000;

export function metricsInterval(rangeMs: number): '5m' | '1h' | '1d' {
  if (rangeMs <= SIX_HOURS) return '5m';
  if (rangeMs <= TWO_DAYS) return '1h';
  return '1d';
}
