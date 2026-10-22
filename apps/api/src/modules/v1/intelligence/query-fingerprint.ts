import { createHash } from 'node:crypto';

export const QUERY_FINGERPRINT_VERSION = 1;

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

export function fingerprintQuery(
  query: string,
  databaseSystem?: string,
): QueryFingerprintResult {
  const canonical = canonicalizeQuery(query);
  const fingerprint = createHash('sha256')
    .update(`${QUERY_FINGERPRINT_VERSION}:${databaseSystem ?? ''}:${canonical.operation}`)
    .digest('hex');

  return {
    identity: {
      fingerprint,
      fingerprintVersion: QUERY_FINGERPRINT_VERSION,
      ...(databaseSystem ? { databaseSystem } : {}),
      operation: canonical.operation,
    },
    evidence: canonical.evidence,
  };
}

export function canonicalizeQuery(query: string): CanonicalQuery {
  const rawQuery = query.trim();
  if (!rawQuery) {
    return { operation: '', evidence: { rawQuery: query, listCardinalities: [] } };
  }

  let operation = rawQuery
    .replace(/--[^\r\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:''|[^'])*'/g, '?')
    .replace(/"(?:""|[^"])*"/g, (match) => match)
    .replace(/\b\d+(?:\.\d+)?\b/g, '?');

  const listCardinalities: number[] = [];
  operation = operation.replace(/\bIN\s*\(([^()]*)\)/gi, (_match, contents: string) => {
    const values = contents
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    listCardinalities.push(values.length);
    return 'IN (?)';
  });

  operation = operation
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return {
    operation,
    evidence: {
      rawQuery: query,
      listCardinalities,
    },
  };
}
