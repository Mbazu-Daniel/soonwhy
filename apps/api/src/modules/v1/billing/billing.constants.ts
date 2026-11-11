import type { UsageMetric } from "../../../common/db/schema/billing";

export const BILLING_PLANS = ["starter", "growth", "enterprise"] as const;
export type BillingPlan = (typeof BILLING_PLANS)[number];

export type UsageLimit = {
  metric: UsageMetric;
  limit: number | null;
  unit: string;
};

export const DEFAULT_USAGE_LIMITS: Record<BillingPlan, UsageLimit[]> = {
  starter: [
    { metric: "ai_tokens", limit: 200_000, unit: "tokens" },
    { metric: "rca_invocations", limit: 200, unit: "invocations" },
  ],
  growth: [
    { metric: "ai_tokens", limit: 2_000_000, unit: "tokens" },
    { metric: "rca_invocations", limit: 2_000, unit: "invocations" },
  ],
  enterprise: [
    { metric: "ai_tokens", limit: null, unit: "tokens" },
    { metric: "rca_invocations", limit: null, unit: "invocations" },
  ],
};

export const USAGE_METRICS: UsageMetric[] = [
  "telemetry_bytes",
  "trace_spans",
  "retained_data_bytes",
  "rca_invocations",
  "ai_tokens",
  "ai_tokens_byok",
  "investigations",
  "sdk_events",
];
