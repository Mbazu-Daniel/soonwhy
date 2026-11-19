import { describe, expect, it } from "vitest";
import { buildFindingReport } from "./finding-report";
import type { ReportRow } from "./finding-report.types";

const now = new Date("2026-05-08T00:00:00.000Z");
const period = { from: new Date("2026-05-01T00:00:00.000Z"), to: now };
const day = (n: number) => new Date(Date.UTC(2026, 4, n));

function row(over: Partial<ReportRow>): ReportRow {
  return {
    id: "f", title: "t", serviceName: "api", category: "performance", severity: "warning", status: "open",
    occurrences: 1, detectedAt: day(2), lastSeenAt: day(3), resolvedAt: null, recommendation: "fix it", ...over,
  };
}

describe("buildFindingReport", () => {
  const rows = [
    row({ id: "a", severity: "critical", category: "error", occurrences: 9, serviceName: "web" }),
    row({ id: "b", occurrences: 3 }),
    row({ id: "c", occurrences: 7 }),
    row({ id: "d", status: "resolved", resolvedAt: day(5), detectedAt: day(1) }),
    row({ id: "e", status: "resolved", resolvedAt: day(30 - 10), detectedAt: new Date("2026-03-01") }),
    row({ id: "g", status: "ignored" }),
  ];
  const report = buildFindingReport(rows, period, now);

  it("counts open, resolved in the period, ignored and new", () => {
    expect(report.totals).toEqual({ open: 3, openCritical: 1, ignored: 1, newInPeriod: 5, resolvedInPeriod: 1 });
  });

  it("ranks critical first, then by how often it recurs", () => {
    expect(report.topOpen.map((item) => item.id)).toEqual(["a", "c", "b"]);
  });

  it("splits counts by category and lists the busiest services", () => {
    expect(report.byCategory.find((item) => item.category === "error")).toEqual({ category: "error", open: 1, resolved: 0, ignored: 0 });
    expect(report.byCategory.find((item) => item.category === "security")).toEqual({ category: "security", open: 0, resolved: 0, ignored: 0 });
    expect(report.services[0]).toEqual({ serviceName: "api", open: 2 });
  });

  it("writes the recommendation and counts into the markdown", () => {
    expect(report.markdown).toContain("- Open: 3 (1 critical)");
    expect(report.markdown).toContain("**Recommended fix:** fix it");
    expect(report.markdown).toContain("## Resolved in period");
  });

  it("says so when nothing is open", () => {
    expect(buildFindingReport([], period, now).markdown).toContain("## Open findings\n\nNone.");
  });
});
