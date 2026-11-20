import type { Grade, TrendStatus } from '@soonwhy/shared/contracts';

export const GRADE_CLASSES: Record<Grade, string> = {
  A: 'text-emerald-600',
  B: 'text-lime-600',
  C: 'text-amber-600',
  D: 'text-orange-600',
  F: 'text-red-600',
};

export const TREND_LABELS: Record<TrendStatus, string> = {
  regressing: 'Regressing',
  improving: 'Improving',
  steady: 'Steady',
  new: 'Not enough history',
};
