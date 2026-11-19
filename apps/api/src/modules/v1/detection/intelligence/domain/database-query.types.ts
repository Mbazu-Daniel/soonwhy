import type { EvidenceObservation } from "./evidence.types";
import { type QueryEvidence, type QueryIdentity } from "./query-fingerprint.types";

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
