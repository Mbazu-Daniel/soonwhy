import type { DetectionEvidence } from '../../../common/db/schema/findings';
import type { DetectionFinding } from '../detections/detection.types';
import { evaluateEvidenceConfidence } from './evidence-confidence';
import type { EvidenceObservation, EvidenceSource } from './evidence.types';
import { createTelemetryIdentity } from './telemetry-identity';
import type { TelemetryDomain } from './telemetry-identity.types';
import type { Issue } from './issue.types';

const SOURCE_MAP: Partial<Record<DetectionEvidence['kind'], EvidenceSource>> = {
  metric: 'metric',
  request: 'request',
  log: 'log',
  trace: 'trace',
};

const DOMAIN_MAP: Record<DetectionFinding['type'], TelemetryDomain> = {
  latency: 'performance',
  error_rate: 'error',
  throughput: 'performance',
  dependency_latency: 'dependency',
  trace_span: 'performance',
  bottleneck: 'performance',
  error_group: 'error',
  database_query: 'database',
  database_n_plus_one: 'database',
  database_query_volume: 'database',
  database_error: 'database',
  database_latency_contribution: 'database',
  database_connection_pool: 'database',
  database_connection_wait: 'database',
  database_batch: 'database',
  database_result_set: 'database',
  database_timeout: 'database',
  performance: 'performance',
};

export function createIssueFromDetection(finding: DetectionFinding): Issue {
  const identity = createTelemetryIdentity({
    domain: DOMAIN_MAP[finding.type],
    serviceName: finding.serviceName,
    operationName: operationName(finding),
    identityAttributes: {
      findingType: finding.type,
      ...identityDimensions(finding.evidence),
    },
  });

  const observations = finding.evidence.flatMap((evidence) => {
    const source = SOURCE_MAP[evidence.kind];
    if (!source) return [];

    return [{
      name: evidence.label,
      value: evidence.value,
      source,
      observedAt: observationTimestamp(evidence, finding),
      ...(evidence.context ? { dimensions: evidence.context } : {}),
    }] satisfies EvidenceObservation[];
  });

  const primaryObservation: EvidenceObservation = {
    name: 'observed-value',
    value: finding.observedValue,
    source: finding.type === 'database_query' || finding.type === 'database_n_plus_one' || finding.type === 'database_query_volume' || finding.type === 'database_error' || finding.type === 'database_latency_contribution' || finding.type === 'database_result_set' || finding.type === 'database_timeout' ? 'trace' : 'metric',
    observedAt: finding.window.end.toISOString(),
    dimensions: {
      findingType: finding.type,
      service: finding.serviceName,
      severity: finding.severity,
    },
  };

  const allObservations = [primaryObservation, ...observations];

  const confidence = evaluateEvidenceConfidence({
    identity,
    observations: allObservations,
    windows: [{
      start: finding.window.start.toISOString(),
      end: finding.window.end.toISOString(),
    }],
  });

  return {
    identity,
    confidence,
    status: confidence.status,
    observations: allObservations,
    windows: [{
      start: finding.window.start.toISOString(),
      end: finding.window.end.toISOString(),
    }],
    firstObservedAt: finding.window.start.toISOString(),
    lastObservedAt: finding.window.end.toISOString(),
  };
}

function operationName(finding: DetectionFinding): string {
  const queryOperation = finding.evidence.find(
    (item) => item.context?.queryOperation,
  )?.context?.queryOperation;

  if (typeof queryOperation === 'string' && queryOperation) return queryOperation;

  const endpoint = finding.evidence.find(
    (item) => item.context?.endpoint,
  )?.context?.endpoint;

  if (typeof endpoint === 'string' && endpoint) return endpoint;

  return finding.type;
}

function identityDimensions(evidence: DetectionEvidence[]): Record<string, string> {
  const dimensions: Record<string, string> = {};

  for (const item of evidence) {
    const dependencyType = item.context?.dependencyType;
    const dependencyName = item.context?.dependencyName;
    if (typeof dependencyType === 'string') dimensions.dependencyType = dependencyType;
    if (typeof dependencyName === 'string') dimensions.dependencyName = dependencyName;

    const fingerprint = item.context?.fingerprint;
    if (typeof fingerprint === 'string') dimensions.fingerprint = fingerprint;

    const databaseSystem = item.context?.databaseSystem;
    if (typeof databaseSystem === 'string') dimensions.databaseSystem = databaseSystem;

    const poolName = item.context?.poolName;
    if (typeof poolName === 'string') dimensions.poolName = poolName;
  }

  return dimensions;
}

function observationTimestamp(evidence: DetectionEvidence, finding: DetectionFinding): string {
  const timestamp = evidence.context?.timestamp;
  if (typeof timestamp === 'string' && Number.isFinite(Date.parse(timestamp))) {
    return timestamp;
  }

  return finding.window.end.toISOString();
}
