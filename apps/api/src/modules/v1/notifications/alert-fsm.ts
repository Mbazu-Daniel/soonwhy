import type { AlertTriggerStatus, AlertState } from "../../../common/db/schema";

/**
 * Explicit lifecycle model for `alert_triggers`.
 *
 * Two fields cooperate (see `alert_triggers` schema):
 *
 *   status   (lifecycle):  active ─▶ resolved
 *   state    (condition):  healthy | pending | firing | no_data | error
 *
 * status rules
 *   - Creation enters (status = "active", state = "firing").
 *   - Only active triggers may change state or streak/reason fields.
 *   - Only active triggers may transition to resolved (sets state = "healthy").
 *   - resolved is terminal for this lifecycle.
 *
 * state rules (only meaningful while status = "active")
 *   Allowed targets from each state:
 *     healthy -> pending | firing | no_data | error | healthy
 *     pending -> firing | pending | healthy | no_data | error
 *     firing  -> pending | firing | healthy | no_data | error
 *     no_data -> healthy | pending | firing | no_data | error
 *     error   -> healthy | pending | firing | no_data | error
 *
 * This module is the single source of truth for those transitions; services
 * should validate through `canTransitionTriggerState` / `canResolveTrigger`
 * instead of updating the columns directly.
 */

export const ALERT_TRIGGER_ACTIVE_TRANSITIONS: Record<AlertState, ReadonlySet<AlertState>> = {
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

export function assertTriggerStateTransition(from: AlertState, to: AlertState): void {
  if (!canTransitionTriggerState(from, to)) {
    throw new Error(`Invalid alert trigger state transition: ${from} -> ${to}`);
  }
}
