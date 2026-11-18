export const AUTO_ANALYSIS_KEY = ['ai-auto-analysis'];
export const MAX_DAILY_CAP = 200;
export const MAX_MIN_OCCURRENCES = 1000;

export function clampInt(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
