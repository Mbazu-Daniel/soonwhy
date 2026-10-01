import { createHash } from 'node:crypto';
import type { CanonicalValue, TelemetryIdentity, TelemetryIdentityInput } from './telemetry-identity.types';

export const TELEMETRY_FINGERPRINT_VERSION = 1;

export function createTelemetryIdentity(input: TelemetryIdentityInput): TelemetryIdentity {
  const fingerprintPayload = {
    domain: input.domain,
    serviceName: input.serviceName ?? null,
    operationName: input.operationName ?? null,
    resourceName: input.resourceName ?? null,
    databaseSystem: input.databaseSystem ?? null,
    identityAttributes: input.identityAttributes ?? {},
  } satisfies CanonicalValue;

  return {
    domain: input.domain,
    fingerprint: fingerprintCanonicalValue(fingerprintPayload),
    fingerprintVersion: TELEMETRY_FINGERPRINT_VERSION,
    ...(input.serviceName ? { serviceName: input.serviceName } : {}),
    ...(input.operationName ? { operationName: input.operationName } : {}),
    ...(input.resourceName ? { resourceName: input.resourceName } : {}),
    ...(input.databaseSystem ? { databaseSystem: input.databaseSystem } : {}),
  };
}

export function fingerprintCanonicalValue(value: CanonicalValue): string {
  const canonical = canonicalize(value);
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function canonicalize(value: CanonicalValue): CanonicalValue {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}
