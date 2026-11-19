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
