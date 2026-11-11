/**
 * Single declarative decision table for the per-condition alert evaluation
 * pipeline (see `alert-evaluation.service.ts`).
 *
 * The evaluation loop computes `AlertEvaluationInputs` for one condition and
 * `decideAlertEvaluationRoute` picks exactly one route; the service then
 * executes that route via a dedicated handler. Route precedence is fixed:
 *
 *   1. no_data            — metric window had no data (no-data policy)
 *   2. healthy_reset      — condition no longer satisfied (streak reset)
 *   3. deduped            — within dedupe window of a recent trigger
 *   4. suppressed         — active maintenance window covers the rule
 *   5. protection_waiting — satisfied but incident-protection streak < 2
 *   6. dispatched         — satisfied and incident-protection met
 *
 * Steps 3-6 only run when the condition is satisfied (and data exists);
 * `shouldDedupe` must not be invoked for unsatisfied conditions because it
 * claims/creates trigger rows.
 */
export type AlertEvaluationRoute =
  | "no_data"
  | "deduped"
  | "suppressed"
  | "protection_waiting"
  | "dispatched"
  | "healthy_reset";

export interface AlertEvaluationInputs {
  hasNoData: boolean;
  satisfied: boolean;
  isDedupe: boolean;
  isSuppressed: boolean;
  hasIncidentProtection: boolean;
}

export function decideAlertEvaluationRoute(
  inputs: AlertEvaluationInputs,
): AlertEvaluationRoute {
  if (inputs.hasNoData) return "no_data";
  if (!inputs.satisfied) return "healthy_reset";
  if (inputs.isDedupe) return "deduped";
  if (inputs.isSuppressed) return "suppressed";
  return inputs.hasIncidentProtection ? "dispatched" : "protection_waiting";
}
