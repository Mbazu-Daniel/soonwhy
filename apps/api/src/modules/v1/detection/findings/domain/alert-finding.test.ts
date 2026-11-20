import { describe, expect, it } from "vitest";
import { alertCategoryOf, alertFinding } from "./alert-finding";
import { findingRow } from "./finding-row";

const alertFindingRow = (input: Parameters<typeof alertFinding>[0]) => findingRow(alertFinding(input));

const base = { orgId: "o", projectId: "p", ruleId: "r1", ruleName: "Checkout errors", ruleSeverity: "high", metric: "http.error_rate", operator: "gt", value: 0.2, threshold: 0.05, at: new Date("2026-05-01T12:00:00Z") };

describe("alert findings", () => {
  it("files an alert under the category its metric implies", () => {
    expect(alertCategoryOf("http.error_rate")).toBe("error");
    expect(alertCategoryOf("auth.failed_logins")).toBe("security");
    expect(alertCategoryOf("http.p95_latency")).toBe("performance");
  });

  it("builds one stable row per rule so repeated firings update the same finding", () => {
    const first = alertFindingRow(base);
    const again = alertFindingRow({ ...base, value: 0.4 });
    expect(first.fingerprint).toBe(again.fingerprint);
    expect(first).toMatchObject({ type: "alert_rule", severity: "critical", category: "error", title: "Alert: Checkout errors", observedValue: 0.2, threshold: 0.05 });
    expect(first.recommendation?.length).toBeGreaterThan(20);
  });

  it("treats medium and low rules as warnings and tolerates non-numeric values", () => {
    expect(alertFindingRow({ ...base, ruleSeverity: "medium", value: "n/a" })).toMatchObject({ severity: "warning", observedValue: 0 });
  });
});
