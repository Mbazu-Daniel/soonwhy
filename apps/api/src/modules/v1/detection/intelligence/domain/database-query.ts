import type { EvidenceObservation } from "./evidence.types";
import { fingerprintQuery } from "./query-fingerprint";
import type { DatabaseQueryObservation, DatabaseQueryInput } from "./database-query.types";

export function createDatabaseQueryObservation(
  input: DatabaseQueryInput,
): DatabaseQueryObservation {
  const result = fingerprintQuery(input.query, input.databaseSystem);
  const observations: EvidenceObservation[] = [];

  if (input.durationMs !== undefined) {
    observations.push({
      name: "query.duration",
      value: input.durationMs,
      source: "database",
      observedAt: input.observedAt,
      unit: "ms",
    });
  }

  if (input.rowCount !== undefined) {
    observations.push({
      name: "query.rows",
      value: input.rowCount,
      source: "database",
      observedAt: input.observedAt,
    });
  }

  if (input.endpoint) {
    observations.push({
      name: "request.endpoint",
      value: input.endpoint,
      source: "request",
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
