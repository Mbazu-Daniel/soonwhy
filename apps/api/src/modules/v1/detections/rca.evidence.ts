import type { CorrelatedBottleneck } from './detection.correlation';
import type { DetectionEvidence } from '../../../common/db/schema/findings';
import type { RcaEvidence, RcaEvidenceItem } from './rca.types';
import { sanitizeRcaContext, sanitizeRcaValue } from './rca.security';

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
    label: sanitizeRcaValue(evidence.label) as string,
    value: sanitizeRcaValue(evidence.value) as number | string,
    context: sanitizeRcaContext(evidence.context),
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
