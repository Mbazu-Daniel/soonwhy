import type { UsageMetric } from "../../../common/db/schema/billing";

export class QuotaExceededError extends Error {
  constructor(readonly metric: UsageMetric) {
    super(`Usage quota exceeded for ${metric}`);
    this.name = "QuotaExceededError";
  }
}
