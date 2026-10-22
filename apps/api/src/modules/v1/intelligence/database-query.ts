import type { CanonicalValue, TelemetryIdentityInput } from './telemetry-identity.types';
import type { EvidenceObservation } from './evidence.types';
import { fingerprintQuery, type QueryEvidence, type QueryIdentity } from './query-fingerprint';

export interface DatabaseQueryIdentity extends QueryIdentity {
  serviceName?: string;
  operationName?: string;
}

export interface DatabaseQueryObservation {
  identity: DatabaseQueryIdentity;
  evidence: QueryEvidence;
  observations: EvidenceObservation[];
}

export interface DatabaseQueryInput {
  query: string;
  databaseSystem?: string;
  serviceName?: string;
  operationName?: string;
  observedAt: string;
  durationMs?: number;
  rowCount?: number;
  endpoint?: string;
}

export function createDatabaseQueryObservation(input: DatabaseQueryInput): DatabaseQueryObservation {
  const result = fingerprintQuery(input.query, input.databaseSystem);
  const observations: EvidenceObservation[] = [];

  if (input.durationMs !== undefined) {
    observations.push({
      name: 'query.duration',
      value: input.durationMs,
      source: 'database',
      observedAt: input.observedAt,
      unit: 'ms',
    });
  }

  if (input.rowCount !== undefined) {
    observations.push({
      name: 'query.rows',
      value: input.rowCount,
      source: 'database',
      observedAt: input.observedAt,
    });
  }

  if (input.endpoint) {
    observations.push({
      name: 'request.endpoint',
      value: input.endpoint,
      source: 'request',
      observedAt: input.observedAt,
    });
  }

  return {
    identity: {
      ...result.identity,
      ...(input.serviceName ? { serviceName: input.serviceName } : {}),
      ...(input.operationName ? { operationName: input.operationName } : {}),
    },
    evidence: result.evidence,
    observations,
  };
}

export function queryIdentityAttributes(
  input: DatabaseQueryInput,
): TelemetryIdentityInput['identityAttributes'] {
  const attributes: Record<string, CanonicalValue> = {};
  if (input.databaseSystem) attributes.databaseSystem = input.databaseSystem;
  return attributes;
}
