import type { DetectionEvidence } from "../../../common/db/schema/findings";
import { ERROR_FINDING_TYPE } from "../errors/error.constants";
import type { BottleneckEvidenceFinding } from "./rca.evidence";
import type { RcaEvidence, RcaEvidenceItem } from "./rca.types";
import { sanitizeRcaContext, sanitizeRcaText, sanitizeRcaValue } from "./rca.security";

const MAX_STACK_EVIDENCE_LENGTH = 2_500;
const LONG_TEXT_LABELS = new Set(["Application frames", "Stack trace"]);

const OCCURRENCES_LABEL = "Occurrences";
const FRAMES_LABEL = "Application frames";
const CAUSE_LABEL = /^Cause \d+$/;
const LATEST_LABEL = "Latest occurrence";
const RAW_STACK_LABEL = "Stack trace";
const TRACE_EXCEPTION_LABEL = "Exception in linked trace";

function item(
  finding: BottleneckEvidenceFinding & { id: string },
  index: number,
  label: string,
  evidence: DetectionEvidence,
): RcaEvidenceItem {
  return {
    id: `${finding.id}:${index}`,
    sourceFindingId: finding.id,
    type: ERROR_FINDING_TYPE,
    severity: finding.severity === "critical" ? "critical" : "warning",
    label,
    value:
      typeof evidence.value === "string" && LONG_TEXT_LABELS.has(evidence.label)
        ? sanitizeRcaText(evidence.value, MAX_STACK_EVIDENCE_LENGTH)
        : (sanitizeRcaValue(evidence.value) as number | string),
    context: sanitizeRcaContext(evidence.context),
  };
}

function isErrorFinding(finding: BottleneckEvidenceFinding): boolean {
  return finding.type === ERROR_FINDING_TYPE;
}

export function buildErrorRcaEvidence(
  finding: BottleneckEvidenceFinding & { id: string },
): RcaEvidence | null {
  if (!isErrorFinding(finding)) return null;
  const evidence = finding.evidence;
  const occurrences = evidence.find((entry) => entry.label === OCCURRENCES_LABEL);
  const latest = evidence.find((entry) => entry.label === LATEST_LABEL);

  const primaryFinding = item(finding, 0, "error-group", {
    kind: "metric",
    label: "error-group",
    value: finding.observedValue,
    context: {
      title: finding.title,
      latestMessage: typeof latest?.value === "string" ? latest.value : null,
      traceCount: occurrences?.context?.traceCount ?? null,
      firstSeen: occurrences?.context?.firstSeen ?? null,
      lastSeen: occurrences?.context?.lastSeen ?? null,
    },
  });

  const supporting: Array<{ label: string; evidence: DetectionEvidence }> = [];
  for (const entry of evidence) {
    if (entry.label === FRAMES_LABEL) supporting.push({ label: "application-frames", evidence: entry });
    else if (CAUSE_LABEL.test(entry.label)) supporting.push({ label: "cause", evidence: entry });
    else if (entry.label === RAW_STACK_LABEL) supporting.push({ label: "stack-trace", evidence: entry });
    else if (entry.label === TRACE_EXCEPTION_LABEL) supporting.push({ label: "trace-exception", evidence: entry });
  }
  const supportingFindings = supporting.map((entry, index) => item(finding, index + 1, entry.label, entry.evidence));

  const traces = evidence
    .filter((entry) => entry.kind === "trace")
    .map((entry, index) => item(finding, supportingFindings.length + index + 1, "latest-trace", entry));

  return {
    projectId: finding.projectId,
    serviceName: sanitizeRcaValue(finding.serviceName) as string,
    severity: finding.severity === "critical" ? "critical" : "warning",
    window: { start: finding.windowStart, end: finding.windowEnd },
    primaryFinding,
    supportingFindings,
    traces,
    recommendations: [],
  };
}
