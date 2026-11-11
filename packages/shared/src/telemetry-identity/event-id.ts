import { createHash } from "node:crypto";

const EVENT_ID_VERSION = 1;

/**
 * Generate a stable, deterministic event ID from a telemetry record.
 *
 * The ID is based on a SHA-256 hash of the stable record fields, excluding
 * ingest-time metadata (eventId, organizationId, projectId, timestamps).
 *
 * This ensures that the same telemetry payload always produces the same event ID,
 * enabling deduplication and idempotent ingestion.
 *
 * @param record - The telemetry record to generate an ID for
 * @returns A deterministic event ID in the format `{version}:{hash}`
 */
export function generateEventId(record: Record<string, unknown>): string {
  // Extract stable fields by removing ingest-time metadata
  const stable: Record<string, unknown> = {
    eventId: undefined,
    organizationId: undefined,
    projectId: undefined,
    capturedAt: undefined,
    updatedAt: undefined,
    createdAt: undefined,
    ...record,
  };

  // Remove undefined values for consistent hashing
  Object.keys(stable).forEach(
    (key) => stable[key] === undefined && delete stable[key],
  );

  // SHA-256 hash of the canonicalized stable record
  const hash = createHash("sha256")
    .update(JSON.stringify(canonicalize(stable)))
    .digest("hex");

  return `${EVENT_ID_VERSION}:${hash}`;
}

/**
 * Canonicalize a value for consistent hashing.
 *
 * Sorts object keys recursively and removes null/undefined values
 * to ensure structural equivalence produces the same hash.
 */
function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (typeof value === "object") {
    const sorted = Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonicalize(v)]),
    );
    return sorted;
  }

  return value;
}
