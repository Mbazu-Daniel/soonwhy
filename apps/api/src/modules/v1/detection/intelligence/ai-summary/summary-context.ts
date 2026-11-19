import type { SummaryContext, SummaryStats } from "./summary-context.types";

export function buildStats(context: SummaryContext): SummaryStats {
  const { overview, findings, openIncidents } = context;
  const critical = findings.filter((f) => f.severity === "critical").length;
  const warning = findings.filter((f) => f.severity === "warning").length;
  const topFinding =
    [...findings].sort(
      (a, b) =>
        severityRank(a.severity) - severityRank(b.severity) ||
        new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
    )[0] ?? null;
  return {
    hasTelemetry: overview.totalRequests > 0,
    requests: overview.totalRequests,
    errorRate: overview.errorRate,
    latencyP95: overview.latencyP95,
    latencyP99: overview.latencyP99,
    totalFindings: findings.length,
    critical,
    warning,
    other: findings.length - critical - warning,
    topFinding: topFinding ? `${topFinding.title} (${topFinding.serviceName})` : null,
    openIncidents,
  };
}

function severityRank(severity: string): number {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

export function sigFigs(value: number, figures = 2): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  const rounded = Number(value.toPrecision(figures));
  const decimals = Math.max(
    figures - 1 - Math.floor(Math.log10(Math.abs(rounded))),
    0,
  );
  return rounded.toFixed(decimals);
}

export function buildPrompt(stats: SummaryStats): string {
  const lines = [
    "Project telemetry for the last 24 hours.",
    `Requests: ${stats.requests.toLocaleString()}`,
    `Error rate: ${sigFigs(stats.errorRate)}%`,
    `p95 latency: ${sigFigs(stats.latencyP95)}ms`,
    `p99 latency: ${sigFigs(stats.latencyP99)}ms`,
    `Findings in window: ${stats.totalFindings} (${stats.critical} critical, ${stats.warning} warning, ${stats.other} other)`,
  ];
  if (stats.topFinding) {
    lines.push(`Most notable finding: ${stats.topFinding}`);
  }
  lines.push(
    `Open incidents (firing or acknowledged): ${stats.openIncidents}`,
    "Summarize as instructed.",
  );
  return lines.join("\n");
}

export function deterministicSummary(stats: SummaryStats): string {
  if (!stats.hasTelemetry && stats.totalFindings === 0 && stats.openIncidents === 0) {
    return "No telemetry in the last 24h. Once events flow, this tile will summarize traffic, errors and findings.";
  }
  const traffic = stats.hasTelemetry
    ? `${stats.requests.toLocaleString()} requests in 24h, ${sigFigs(stats.errorRate)}% errors (p95 ${sigFigs(stats.latencyP95)}ms, p99 ${sigFigs(stats.latencyP99)}ms).`
    : "No requests in the last 24h.";
  const findingsPart =
    stats.totalFindings === 0
      ? "No new findings."
      : `${stats.totalFindings} finding${plural(stats.totalFindings)} detected${severityClause(stats)}${topFindingClause(stats)}.`;
  const incidentPart =
    stats.openIncidents === 0
      ? "No open incidents."
      : `${stats.openIncidents} open incident${plural(stats.openIncidents)}.`;
  return `${traffic} ${findingsPart} ${incidentPart}`;
}

function plural(count: number): string {
  return count === 1 ? "" : "s";
}

function severityClause(stats: SummaryStats): string {
  const parts: string[] = [];
  if (stats.critical > 0) parts.push(`${stats.critical} critical`);
  if (stats.warning > 0) parts.push(`${stats.warning} warning`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

function topFindingClause(stats: SummaryStats): string {
  return stats.topFinding ? `, most notable: ${stats.topFinding}` : "";
}
