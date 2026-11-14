import { createHash } from "node:crypto";

const EVENT_ID_VERSION = 1;

export function generateEventId(record: Record<string, unknown>): string {
  const stable: Record<string, unknown> = {
    eventId: undefined,
    organizationId: undefined,
    projectId: undefined,
    capturedAt: undefined,
    updatedAt: undefined,
    createdAt: undefined,
    ...record,
  };

  Object.keys(stable).forEach(
    (key) => stable[key] === undefined && delete stable[key],
  );

  const hash = createHash("sha256")
    .update(JSON.stringify(canonicalize(stable)))
    .digest("hex");

  return `${EVENT_ID_VERSION}:${hash}`;
}

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
