export const SPEND_PERIODS = [
  { value: 'month', label: 'This month', phrase: 'this month' },
  { value: 'last_month', label: 'Last month', phrase: 'last month' },
  { value: 'last_30_days', label: 'Last 30 days', phrase: 'in the last 30 days' },
] as const;

export type SpendPeriod = (typeof SPEND_PERIODS)[number]['value'];

export const AI_USAGE_KEY = 'ai-usage';
