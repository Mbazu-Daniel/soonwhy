import type { AlertTriggerStatus, AlertState } from "../../../common/db/schema";

const ALERT_TRIGGER_ACTIVE_TRANSITIONS: Record<AlertState, ReadonlySet<AlertState>> = {
  healthy: new Set(["healthy", "pending", "firing", "no_data", "error"]),
  pending: new Set(["pending", "firing", "healthy", "no_data", "error"]),
  firing: new Set(["firing", "pending", "healthy", "no_data", "error"]),
  no_data: new Set(["no_data", "healthy", "pending", "firing", "error"]),
  error: new Set(["error", "healthy", "pending", "firing", "no_data"]),
};

export function canTransitionTriggerState(from: AlertState, to: AlertState): boolean {
  return ALERT_TRIGGER_ACTIVE_TRANSITIONS[from]?.has(to) ?? false;
}

export function canResolveTrigger(status: AlertTriggerStatus): boolean {
  return status === "active";
}
