import type { EvidenceConfidence } from './evidence-confidence';
import type { EvidenceObservation, EvidenceWindow } from './evidence.types';
import type { Issue } from './issue.types';
import type { TelemetryIdentity } from './telemetry-identity.types';

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

  const observations = validObservations(input.observations);
  const windows = uniqueValidWindows(input.windows);

  if (observations.length === 0 || windows.length === 0) {
    return undefined;
  }

  return {
    identity: input.identity,
    confidence: input.confidence,
    status: input.confidence.status,
    observations,
    windows,
    firstObservedAt: minTimestamp(observations),
    lastObservedAt: maxTimestamp(observations),
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

function validObservations(
  observations: EvidenceObservation[],
): EvidenceObservation[] {
  return observations.filter((observation) => Number.isFinite(Date.parse(observation.observedAt)));
}

function uniqueValidWindows(windows: EvidenceWindow[]): EvidenceWindow[] {
  const seen = new Set<string>();

  return windows.filter((window) => {
    const start = Date.parse(window.start);
    const end = Date.parse(window.end);

    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
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
  return observations.reduce((earliest, observation) =>
    Date.parse(observation.observedAt) < Date.parse(earliest.observedAt)
      ? observation
      : earliest,
  ).observedAt;
}

function maxTimestamp(observations: EvidenceObservation[]): string {
  return observations.reduce((latest, observation) =>
    Date.parse(observation.observedAt) > Date.parse(latest.observedAt)
      ? observation
      : latest,
  ).observedAt;
}
