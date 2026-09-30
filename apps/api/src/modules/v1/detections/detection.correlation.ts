import type { DetectionFinding } from './detection.types';

export interface CorrelatedBottleneck {
  serviceName: string;
  latency: DetectionFinding;
  supportingFindings: DetectionFinding[];
  recommendation: string;
  dependencyType?: string;
  dependencyName?: string;
  traceIds: string[];
}

export function correlateFindings(findings: DetectionFinding[]): CorrelatedBottleneck[] {
  const byService = new Map<string, DetectionFinding[]>();

  for (const finding of findings) {
    const serviceFindings = byService.get(finding.serviceName) ?? [];
    serviceFindings.push(finding);
    byService.set(finding.serviceName, serviceFindings);
  }

  return Array.from(byService.values()).flatMap((serviceFindings) => {
    const latency = serviceFindings.find((finding) => finding.type === 'latency' || finding.type === 'performance');
    if (!latency) return [];

    const latencyTraceIds = traceIdsFrom(latency.evidence);
    const supportingFindings = serviceFindings.filter((finding) => {
      if (finding.type === 'error_rate' || finding.type === 'throughput') return true;
      if (finding.type !== 'dependency_latency' && finding.type !== 'trace_span') return false;
      const candidateTraceIds = traceIdsFrom(finding.evidence);
      if (!latencyTraceIds.length) return true;
      return candidateTraceIds.some((traceId) => latencyTraceIds.includes(traceId));
    });

    const dependency = supportingFindings.find(
      (finding) => finding.type === 'dependency_latency',
    );
    const traceIds = Array.from(
      new Set(
        supportingFindings.flatMap((finding) =>
          finding.evidence.flatMap((evidence) => {
            const traceId = evidence.context?.traceId;
            return typeof traceId === 'string' && traceId ? [traceId] : [];
          }),
        ),
      ),
    );

    if (!dependency && !supportingFindings.some((finding) => finding.type === 'trace_span')) {
      return [];
    }

    const dependencyEvidence = dependency?.evidence.find(
      (evidence) => evidence.label === 'optimization-guidance',
    );
    const dependencyType = typeof dependencyEvidence?.context?.dependencyType === 'string'
      ? dependencyEvidence.context.dependencyType
      : undefined;
    const dependencyName = typeof dependencyEvidence?.context?.dependencyName === 'string'
      ? dependencyEvidence.context.dependencyName
      : undefined;

    return [{
      serviceName: latency.serviceName,
      latency,
      supportingFindings,
      recommendation: dependencyType
        ? dependencyRecommendation(dependencyType)
        : 'Inspect the trace evidence for the dominant operation first. Confirm whether the work is necessary, repeated, or doing more data processing than the request requires.',
      dependencyType,
      dependencyName,
      traceIds,
    }];
  });
}

function dependencyRecommendation(dependencyType: string): string {
  switch (dependencyType) {
    case 'database':
      return 'Inspect the database query shape and execution plan first. Check for N+1 queries, missing indexes, excessive reads or selected fields, offset pagination, and repeated queries. Use EXPLAIN ANALYZE before changing the query or schema.';
    case 'http':
      return 'Inspect the downstream HTTP call first. Check latency, payload size, retries, timeouts, connection reuse, and whether the call can be avoided or reduced.';
    case 'rpc':
      return 'Inspect the downstream RPC call first. Check latency, retries, timeouts, connection reuse, and whether multiple calls can be batched or avoided.';
    default:
      return 'Inspect the downstream operation first. Check for repeated calls, unnecessary work, and connection or pooling issues.';
  }
}

function traceIdsFrom(evidence: Array<{ context?: Record<string, unknown> }>): string[] {
  return evidence.flatMap((item) => {
    const traceId = item.context?.traceId;
    return typeof traceId === 'string' && traceId ? [traceId] : [];
  });
}
