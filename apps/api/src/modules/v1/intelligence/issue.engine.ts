import type { EvidenceConfidence } from './evidence-confidence';
import type { EvidenceObservation, EvidenceWindow } from './evidence.types';
import type { TelemetryIdentity } from './telemetry-identity.types';
import type { Issue } from './issue.types';

export interface BuildIssueInput {
  identity: TelemetryIdentity;
  confidence: EvidenceConfidence;
  observations: EvidenceObservation[];
  windows: EvidenceWindow[];
}

export function buildIssue(input: BuildIssueInput): Issue | undefined {
  if (!sameIdentity(input.identity, input.confidence.identity)) {
    return undefined;
  }

  const validWindows = uniqueValidWindows(input.windows);

  if (input.observations.length === 0 || validWindows.length === 0) {
    return undefined;
  }

  return {
    identity: input.identity,
    status: input.confidence.status,
    observations: input.observations,
    windows: validWindows,
    firstObservedAt: minTimestamp(input.observations),
    lastObservedAt: maxTimestamp(input.observations),
  };
}

function sameIdentity(left: TelemetryIdentity, right: TelemetryIdentity): boolean {
  return (
    left.domain === right.domain &&
    left.fingerprint === right.fingerprint &&
    left.fingerprintVersion === right.fingerprintVersion &&
    left.serviceName === right.serviceName &&
    left.operationName === right.operationName &&
    left.resourceName === right.resourceName &&
    left.databaseSystem === right.databaseSystem
  );
}

function uniqueValidWindows(windows: EvidenceWindow[]): EvidenceWindow[] {
  const seen = new Set<string>();

  return windows.filter((window) => {
    if (window.start >= window.end) {
      return false;
    }

    const key = `${window.start}:${window.end}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function minTimestamp(observations: EvidenceObservation[]): string {
  return observations.reduce(
    (earliest, observation) =>
      observation.observedAt < earliest ? observation.observedAt : earliest,
    observations[0].observedAt,
  );
}

function maxTimestamp(observations: EvidenceObservation[]): string {
  return observations.reduce(
    (latest, observation) =>
      observation.observedAt > latest ? observation.observedAt : latest,
    observations[0].observedAt,
  );
}
