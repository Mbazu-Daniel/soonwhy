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
