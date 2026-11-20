import type { FindingReport, ReportFinding } from "./finding-report.types";

type ReportBody = Omit<FindingReport, "markdown">;

const day = (iso: string) => iso.slice(0, 10);

function openItem(finding: ReportFinding): string {
  const lines = [
    `### ${finding.title}`,
    `${finding.severity} · ${finding.category} · ${finding.serviceName} · seen ${finding.occurrences}x · last seen ${day(finding.lastSeenAt)}`,
  ];
  if (finding.recommendation) lines.push("", `**Recommended fix:** ${finding.recommendation}`);
  return lines.join("\n");
}

export function renderReportMarkdown(report: ReportBody): string {
  const { totals } = report;
  const sections = [
    `# Findings report`,
    `Period: ${day(report.period.from)} to ${day(report.period.to)}`,
    [
      "## Summary",
      "",
      `- Open: ${totals.open} (${totals.openCritical} critical)`,
      `- New in period: ${totals.newInPeriod}`,
      `- Resolved in period: ${totals.resolvedInPeriod}`,
      `- Ignored: ${totals.ignored}`,
    ].join("\n"),
    [
      "## By category",
      "",
      "| Category | Open | Resolved | Ignored |",
      "|---|---|---|---|",
      ...report.byCategory.map((row) => `| ${row.category} | ${row.open} | ${row.resolved} | ${row.ignored} |`),
    ].join("\n"),
  ];

  if (report.services.length) {
    sections.push(["## Services with the most open findings", "", ...report.services.map((row) => `- ${row.serviceName}: ${row.open}`)].join("\n"));
  }
  sections.push(
    report.topOpen.length
      ? ["## Open findings", "", report.topOpen.map(openItem).join("\n\n")].join("\n")
      : "## Open findings\n\nNone.",
  );
  if (report.resolved.length) {
    sections.push(
      ["## Resolved in period", "", ...report.resolved.map((row) => `- ${row.title} (${row.serviceName}), resolved ${day(row.resolvedAt ?? row.lastSeenAt)}`)].join("\n"),
    );
  }
  return `${sections.join("\n\n")}\n`;
}
