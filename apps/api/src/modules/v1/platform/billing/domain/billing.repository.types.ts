import { type UsageMetric } from "../../../../../common/db/schema";

export type RecordUsageInput = {
  orgId: string;
  projectId?: string;
  metric: UsageMetric;
  quantity: number;
  source: string;
  idempotencyKey?: string;
  occurredAt?: Date;
  metadata?: Record<string, string | number | boolean | null>;
};
