import type { CorrelatedBottleneck } from "./detection.correlation";
import type { DetectionFinding } from "./detection.types";
import type { DetectionEvidence } from "../../../common/db/schema/findings";
import type { RcaEvidence, RcaEvidenceItem } from "./rca.types";
import type { RankingResult } from "./root-cause/root-cause.types";
import { sanitizeRcaContext, sanitizeRcaValue } from "./rca.security";

function toItem(
  findingId: string,
  type: RcaEvidenceItem["type"],
  severity: RcaEvidenceItem["severity"],
  evidence: DetectionEvidence,
  index: number,
): RcaEvidenceItem {
  return {
    id: findingId + ":" + index,
    sourceFindingId: findingId,
    type,
    severity,
    label: sanitizeRcaValue(evidence.label) as string,
    value: sanitizeRcaValue(evidence.value) as number | string,
    context: sanitizeRcaContext(evidence.context),
  };
}

function collect(
  findingId: string,
  type: RcaEvidenceItem["type"],
  severity: RcaEvidenceItem["severity"],
  evidence: DetectionEvidence[],
  predicate: (item: DetectionEvidence) => boolean,
): RcaEvidenceItem[] {
  return evidence
    .filter(predicate)
    .map((item, index) => toItem(findingId, type, severity, item, index));
}

export function buildRcaEvidence(
  projectId: string,
  bottleneck: CorrelatedBottleneck,
  rankingResult?: RankingResult,
): RcaEvidence {
  const primaryFinding = toItem(
    bottleneck.latency.id,
    bottleneck.latency.type,
    bottleneck.latency.severity,
    {
      kind: "metric",
      label: "primary-latency",
      value: bottleneck.latency.observedValue,
      context: {
        threshold: bottleneck.latency.threshold,
        unit: bottleneck.latency.unit,
        baselineValue:
          bottleneck.latency.evidence.find(
            (item) => item.context?.baselineValue !== undefined,
          )?.context?.baselineValue ?? null,
        changePercent:
          bottleneck.latency.evidence.find(
            (item) => item.context?.changePercent !== undefined,
          )?.context?.changePercent ?? null,
      },
    },
    0,
  );

  const supportingFindings = bottleneck.supportingFindings.flatMap((finding) =>
    collect(
      finding.id,
      finding.type,
      finding.severity,
      finding.evidence,
      (item) => item.kind !== "trace" && item.kind !== "recommendation",
    ),
  );

  const traces = bottleneck.supportingFindings.flatMap((finding) =>
    collect(
      finding.id,
      finding.type,
      finding.severity,
      finding.evidence,
      (item) => item.kind === "trace",
    ),
  );

  const recommendations = [
    ...bottleneck.supportingFindings.flatMap((finding) =>
      collect(
        finding.id,
        finding.type,
        finding.severity,
        finding.evidence,
        (item) => item.kind === "recommendation",
      ),
    ),
    {
      id: bottleneck.latency.id + ":correlation-guidance",
      sourceFindingId: bottleneck.latency.id,
      type: "latency" as const,
      severity: bottleneck.latency.severity,
      label: "correlation-guidance",
      value: sanitizeRcaValue(bottleneck.recommendation) as string,
      context: sanitizeRcaContext({
        dependencyType: bottleneck.dependencyType ?? null,
        dependencyName: bottleneck.dependencyName ?? null,
      }),
    },
  ];

  return {
    projectId,
    serviceName: sanitizeRcaValue(bottleneck.serviceName) as string,
    severity: bottleneck.supportingFindings.some(
      (finding) => finding.severity === "critical",
    )
      ? "critical"
      : bottleneck.latency.severity,
    window: bottleneck.latency.window,
    primaryFinding,
    supportingFindings,
    traces,
    recommendations,
    rankedCandidates: rankingResult?.candidates,
    rankingWeights: rankingResult?.weights,
    evidenceCoverage: rankingResult?.overallEvidenceCoverage,
    rankingLimitations: rankingResult?.limitations,
  };
}

export interface BottleneckEvidenceFinding {
  type: string;
  projectId: string;
  serviceName: string;
  severity: string;
  title: string;
  description: string;
  observedValue: number;
  threshold: number;
  unit: string;
  windowStart: Date;
  windowEnd: Date;
  evidence: DetectionEvidence[];
}

export function decodeRcaBottleneck(
  finding: BottleneckEvidenceFinding,
): CorrelatedBottleneck | null {
  if (!finding || finding.type !== "bottleneck") return null;
  const evidence = finding.evidence;
  const correlated = evidence.find(
    (item) => item.label === "correlated-signal",
  );
  if (!correlated) return null;

  const latencyId = String(correlated.context?.sourceFindingId ?? "");
  if (!latencyId) return null;

  const guidance = evidence.find(
    (item) => item.label === "optimization-guidance",
  );
  const supportingFindings = evidence
    .filter((item) => item.label === "supporting-finding")
    .map((item) => ({
      id: String(item.context?.findingId ?? ""),
      projectId: finding.projectId,
      serviceName: finding.serviceName,
      type: String(
        item.context?.findingType ?? "latency",
      ) as DetectionFinding["type"],
      severity: String(item.context?.severity ?? "warning") as
        | "warning"
        | "critical",
      title: String(item.context?.findingType ?? "Supporting finding"),
      description: "",
      observedValue: Number(item.value),
      threshold: 0,
      unit: "unknown",
      window: { start: finding.windowStart, end: finding.windowEnd },
      evidence: [item],
    }));

  return {
    serviceName: finding.serviceName,
    latency: {
      id: latencyId,
      projectId: finding.projectId,
      serviceName: finding.serviceName,
      type: "latency",
      severity: finding.severity as "warning" | "critical",
      title: "Correlated latency",
      description: finding.description,
      observedValue: finding.observedValue,
      threshold: finding.threshold,
      unit: finding.unit,
      window: { start: finding.windowStart, end: finding.windowEnd },
      evidence: [correlated],
    },
    supportingFindings,
    recommendation: String(guidance?.value ?? ""),
    dependencyType:
      typeof guidance?.context?.dependencyType === "string"
        ? guidance.context.dependencyType
        : undefined,
    dependencyName:
      typeof guidance?.context?.dependencyName === "string"
        ? guidance.context.dependencyName
        : undefined,
    traceIds: evidence
      .filter((item) => item.label === "correlated-trace")
      .map((item) => String(item.value)),
  };
}
