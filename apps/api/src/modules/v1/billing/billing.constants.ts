import type { UsageMetric } from '../../../common/db/schema/billing';

export const BILLING_PLANS = ['starter', 'growth', 'enterprise'] as const;
export type BillingPlan = (typeof BILLING_PLANS)[number];

export type UsageLimit = {
  metric: UsageMetric;
  limit: number | null;
  unit: string;
};

export const DEFAULT_USAGE_LIMITS: Record<BillingPlan, UsageLimit[]> = {
  starter: [],
  growth: [],
  enterprise: [],
};

export const USAGE_METRICS: UsageMetric[] = [
  'telemetry_bytes',
  'trace_spans',
  'retained_data_bytes',
  'rca_invocations',
  'ai_tokens',
  'investigations',
  'sdk_events',
];
