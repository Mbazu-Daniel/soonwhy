import type { UsageMetric } from "../../../common/db/schema/billing";

/**
 * Thrown when monthly usage has passed the configured limit. A plain `Error`
 * reached the HTTP layer as a 500, which hid a perfectly ordinary "you have run
 * out of quota" from the client.
 */
export class QuotaExceededError extends Error {
  constructor(readonly metric: UsageMetric) {
    super(`Usage quota exceeded for ${metric}`);
    this.name = "QuotaExceededError";
  }
}
