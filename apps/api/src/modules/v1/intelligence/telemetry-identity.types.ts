export type TelemetryDomain =
  | 'performance'
  | 'error'
  | 'database'
  | 'dependency'
  | 'runtime'
  | 'infrastructure'
  | 'ai';

export interface TelemetryIdentity {
  domain: TelemetryDomain;
  fingerprint: string;
  fingerprintVersion: number;
  serviceName?: string;
  operationName?: string;
  resourceName?: string;
  databaseSystem?: string;
}

export interface TelemetryIdentityInput {
  domain: TelemetryDomain;
  serviceName?: string;
  operationName?: string;
  resourceName?: string;
  databaseSystem?: string;
  identityAttributes?: Record<string, CanonicalValue>;
}

export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };
