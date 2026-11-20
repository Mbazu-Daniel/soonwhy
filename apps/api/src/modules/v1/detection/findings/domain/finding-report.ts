import { FINDING_CATEGORIES } from "../../../../../common/db/schema/finding-lifecycle";
import {
  REPORT_TOP_OPEN,
  REPORT_TOP_RESOLVED,
  REPORT_TOP_SERVICES,
  SEVERITY_RANK,
} from "./finding-report.constants";
import { renderReportMarkdown } from "./finding-report.markdown";
import type { FindingReport, ReportFinding, ReportPeriod, ReportRow } from "./finding-report.types";

const inPeriod = (date: Date | null, period: ReportPeriod) =>
  date !== null && date >= period.from && date <= period.to;

function toReportFinding(row: ReportRow): ReportFinding {
  return {
    id: row.id,
    title: row.title,
    serviceName: row.serviceName,
    category: row.category,
    severity: row.severity,
    occurrences: row.occurrences,
    detectedAt: row.detectedAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    recommendation: row.recommendation,
  };
}

const byUrgency = (a: ReportRow, b: ReportRow) =>
  (SEVERITY_RANK[a.severity] ?? 2) - (SEVERITY_RANK[b.severity] ?? 2) ||
  b.occurrences - a.occurrences ||
  b.lastSeenAt.getTime() - a.lastSeenAt.getTime();

export function buildFindingReport(rows: ReportRow[], period: ReportPeriod, now = new Date()): FindingReport {
  const open = rows.filter((row) => row.status === "open");
  const resolved = rows.filter((row) => row.status === "resolved" && inPeriod(row.resolvedAt, period));
  const ignored = rows.filter((row) => row.status === "ignored");

  const serviceCounts = new Map<string, number>();
  for (const row of open) serviceCounts.set(row.serviceName, (serviceCounts.get(row.serviceName) ?? 0) + 1);

  const report: Omit<FindingReport, "markdown"> = {
    generatedAt: now.toISOString(),
    period: { from: period.from.toISOString(), to: period.to.toISOString() },
    totals: {
      open: open.length,
      openCritical: open.filter((row) => row.severity === "critical").length,
      ignored: ignored.length,
      newInPeriod: rows.filter((row) => inPeriod(row.detectedAt, period)).length,
      resolvedInPeriod: resolved.length,
    },
    byCategory: FINDING_CATEGORIES.map((category) => ({
      category,
      open: open.filter((row) => row.category === category).length,
      resolved: resolved.filter((row) => row.category === category).length,
      ignored: ignored.filter((row) => row.category === category).length,
    })),
    topOpen: [...open].sort(byUrgency).slice(0, REPORT_TOP_OPEN).map(toReportFinding),
    resolved: [...resolved]
      .sort((a, b) => (b.resolvedAt?.getTime() ?? 0) - (a.resolvedAt?.getTime() ?? 0))
      .slice(0, REPORT_TOP_RESOLVED)
      .map(toReportFinding),
    services: [...serviceCounts.entries()]
      .map(([serviceName, count]) => ({ serviceName, open: count }))
      .sort((a, b) => b.open - a.open || a.serviceName.localeCompare(b.serviceName))
      .slice(0, REPORT_TOP_SERVICES),
  };

  return { ...report, markdown: renderReportMarkdown(report) };
}
