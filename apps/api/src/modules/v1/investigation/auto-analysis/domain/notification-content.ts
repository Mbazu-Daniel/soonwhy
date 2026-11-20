import type { AlertRuleSeverity } from "../../../../../common/db/schema";
import type { AnalysisSummary, AnalyzedFinding } from "./notification-content.types";

const MAX_LINE = 400;

function trimmed(text: string): string {
  return text.length > MAX_LINE ? `${text.slice(0, MAX_LINE - 1)}…` : text;
}

export function analysisNotification(finding: AnalyzedFinding, analysis: AnalysisSummary) {
  const lines = [
    `Soonwhy analyzed a critical error in ${finding.serviceName}.`,
    `Summary: ${trimmed(analysis.summary)}`,
    `Likely cause: ${trimmed(analysis.rootCause)}`,
  ];
  const [fix] = analysis.suggestedChanges;
  if (fix) lines.push(`Suggested fix: ${trimmed(fix)}`);
  lines.push(`Confidence: ${analysis.confidence}`);
  return {
    incidentId: `auto-analysis-${analysis.id}`,
    severity: "critical" as AlertRuleSeverity,
    title: `Analysis ready: ${finding.title}`,
    body: lines.join("\n"),
    metadata: { findingId: finding.id, analysisId: analysis.id, autoAnalysis: "true" },
  };
}
