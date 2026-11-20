export const FAST_P95_MS = 200;
export const SLOW_P95_MS = 2000;
export const LATENCY_POINTS = 50;
export const ERROR_FREE_POINTS = 40;
export const ERROR_RATE_ZERO_POINTS = 10;
export const TAIL_POINTS = 10;
export const TAIL_OK_RATIO = 5;
export const TAIL_BAD_RATIO = 30;
export const ERROR_SCORE_CAPS = [
  { atLeast: 50, cap: 30 },
  { atLeast: 20, cap: 50 },
  { atLeast: 10, cap: 65 },
] as const;
export const GRADES = [
  { min: 90, grade: "A" },
  { min: 75, grade: "B" },
  { min: 60, grade: "C" },
  { min: 40, grade: "D" },
  { min: 0, grade: "F" },
] as const;
export const TREND_MIN_REQUESTS = 10;
export const TREND_LATENCY_CHANGE = 0.25;
export const TREND_LATENCY_MIN_MS = 50;
export const TREND_ERROR_POINTS = 2;
export const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
