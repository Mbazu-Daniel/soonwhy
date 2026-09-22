import type { CorrelatedBottleneck } from './detection.correlation';
import type { DetectionEvidence } from '../../../common/db/schema/findings';
import type { RcaEvidence, RcaEvidenceItem } from './rca.types';

function toItem(
  findingId: string,
  type: RcaEvidenceItem['type'],
  severity: RcaEvidenceItem['severity'],
  evidence: DetectionEvidence,
  index: number,
): RcaEvidenceItem {
  return {
    id: findingId + ':' + index,
    sourceFindingId: findingId,
    type,
    severity,
    label: evidence.label,
    value: evidence.value,
    context: evidence.context,
  };
}

function collect(
  findingId: string,
  type: RcaEvidenceItem['type'],
  severity: RcaEvidenceItem['severity'],
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
): RcaEvidence {
  const primaryFinding = toItem(
    bottleneck.latency.id,
    bottleneck.latency.type,
    bottleneck.latency.severity,
    {
      kind: 'metric',
      label: 'primary-latency',
      value: bottleneck.latency.observedValue,
      context: {
        threshold: bottleneck.latency.threshold,
        unit: bottleneck.latency.unit,
        baselineValue: bottleneck.latency.evidence
          .find((item) => item.context?.baselineValue !== undefined)
          ?.context?.baselineValue ?? null,
        changePercent: bottleneck.latency.evidence
          .find((item) => item.context?.changePercent !== undefined)
          ?.context?.changePercent ?? null,
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
      (item) => item.kind !== 'trace' && item.kind !== 'recommendation',
    ),
  );

  const traces = bottleneck.supportingFindings.flatMap((finding) =>
    collect(
      finding.id,
      finding.type,
      finding.severity,
      finding.evidence,
      (item) => item.kind === 'trace',
    ),
  );

  const recommendations = [
    ...bottleneck.supportingFindings.flatMap((finding) =>
      collect(
        finding.id,
        finding.type,
        finding.severity,
        finding.evidence,
        (item) => item.kind === 'recommendation',
      ),
    ),
    {
      id: bottleneck.latency.id + ':correlation-guidance',
      sourceFindingId: bottleneck.latency.id,
      type: 'latency' as const,
      severity: bottleneck.latency.severity,
      label: 'correlation-guidance',
      value: bottleneck.recommendation,
      context: {
        dependencyType: bottleneck.dependencyType ?? null,
        dependencyName: bottleneck.dependencyName ?? null,
      },
    },
  ];

  return {
    projectId,
    serviceName: bottleneck.serviceName,
    severity: bottleneck.supportingFindings.some((finding) => finding.severity === 'critical')
      ? 'critical'
      : bottleneck.latency.severity,
    window: bottleneck.latency.window,
    primaryFinding,
    supportingFindings,
    traces,
    recommendations,
  };
}
