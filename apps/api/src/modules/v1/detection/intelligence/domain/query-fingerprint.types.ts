export interface QueryIdentity {
  fingerprint: string;
  fingerprintVersion: number;
  databaseSystem?: string;
  operation: string;
}

export interface QueryEvidence {
  rawQuery: string;
  listCardinalities: number[];
}

export interface CanonicalQuery {
  operation: string;
  evidence: QueryEvidence;
}

export interface QueryFingerprintResult {
  identity: QueryIdentity;
  evidence: QueryEvidence;
}
