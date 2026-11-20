import type { FindingCategory } from "../../../../../common/db/schema/finding-lifecycle";
import { ALERT_CATEGORY_PATTERNS, ALERT_DEFAULT_CATEGORY, ALERT_FINDING_SERVICE, ALERT_FINDING_TYPE } from "./alert-finding.constants";
import type { AlertFindingInput } from "./alert-finding.types";
import { findingFingerprint } from "./finding-fingerprint";
import type { RaisedFinding } from "./finding-row.types";

export function alertFindingFingerprint(ruleId: string): string {
  return findingFingerprint(ALERT_FINDING_TYPE, ALERT_FINDING_SERVICE, ruleId);
}

export function alertCategoryOf(metric: string): FindingCategory {
  return ALERT_CATEGORY_PATTERNS.find((entry) => entry.pattern.test(metric))?.category ?? ALERT_DEFAULT_CATEGORY;
}

function numberOf(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function alertFinding(input: AlertFindingInput): RaisedFinding {
  const critical = input.ruleSeverity === "critical" || input.ruleSeverity === "high";
  return {
    orgId: input.orgId,
    projectId: input.projectId,
    serviceName: ALERT_FINDING_SERVICE,
    type: ALERT_FINDING_TYPE,
    key: input.ruleId,
    category: input.category ?? alertCategoryOf(input.metric),
    severity: critical ? "critical" : "warning",
    title: `Alert: ${input.ruleName}`,
    description: `${input.description ?? input.metric} violated: ${input.metric} is ${String(input.value)} (threshold ${String(input.threshold)}).`,
    observedValue: numberOf(input.value),
    threshold: numberOf(input.threshold),
    unit: "",
    windowStart: input.at,
    windowEnd: input.at,
    evidence: [
      {
        kind: "metric",
        label: "alert-condition",
        value: numberOf(input.value),
        context: { alertRuleId: input.ruleId, metric: input.metric, operator: input.operator, threshold: String(input.threshold) },
      },
    ],
  };
}
