import type { AlertEvaluationRoute, AlertEvaluationInputs } from "./alert-evaluation-fsm.types";

export function decideAlertEvaluationRoute(
  inputs: AlertEvaluationInputs,
): AlertEvaluationRoute {
  if (inputs.hasNoData) return "no_data";
  if (!inputs.satisfied) return "healthy_reset";
  if (inputs.isDedupe) return "deduped";
  if (inputs.isSuppressed) return "suppressed";
  return inputs.hasIncidentProtection ? "dispatched" : "protection_waiting";
}
