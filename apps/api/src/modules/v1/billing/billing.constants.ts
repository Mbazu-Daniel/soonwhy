import type { UsageMetric } from "../../../common/db/schema/billing";

export type BillingPlan = "starter" | "growth" | "enterprise";

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

