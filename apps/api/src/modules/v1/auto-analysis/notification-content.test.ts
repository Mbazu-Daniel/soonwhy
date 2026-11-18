import { describe, expect, it } from "vitest";
import { analysisNotification } from "./notification-content";

const finding = { id: "f1", title: "HTTP 500 in api: boom", serviceName: "api" };
const analysis = { id: "a1", summary: "Null user", rootCause: "Missing guard", suggestedChanges: ["Add a null check"], confidence: "high" };

describe("analysisNotification", () => {
  it("is keyed by the analysis so a resend is deduplicated", () => {
    expect(analysisNotification(finding, analysis).incidentId).toBe("auto-analysis-a1");
  });
  it("includes the cause and the first fix", () => {
    const { body } = analysisNotification(finding, analysis);
    expect(body).toContain("Missing guard");
    expect(body).toContain("Add a null check");
  });
  it("omits the fix line when there is none", () => {
    expect(analysisNotification(finding, { ...analysis, suggestedChanges: [] }).body).not.toContain("Suggested fix");
  });
  it("truncates a very long cause", () => {
    expect(analysisNotification(finding, { ...analysis, rootCause: "x".repeat(2000) }).body.length).toBeLessThan(1200);
  });
});
