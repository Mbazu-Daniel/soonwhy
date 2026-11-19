import { type AlertRuleStatus } from "../../../../common/db/schema";

export const ALERT_RULE_STATUSES = new Set<AlertRuleStatus>(["active", "disabled"]);
