import type { FindingCategory } from "../../../../../common/db/schema/finding-lifecycle";

export const ALERT_FINDING_TYPE = "alert_rule";
export const ALERT_FINDING_SERVICE = "Alert rules";

export const ALERT_CATEGORY_PATTERNS: ReadonlyArray<{ category: FindingCategory; pattern: RegExp }> = [
  { category: "security", pattern: /auth|login|secret|token|forbidden|unauthori[sz]ed|intrusion|attack|breach/i },
  { category: "error", pattern: /error|exception|fail|5xx|crash|panic/i },
];
export const ALERT_DEFAULT_CATEGORY: FindingCategory = "performance";
