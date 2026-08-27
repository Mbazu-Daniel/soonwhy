import crypto from 'node:crypto';

/**
 * Generate a UUIDv7 — time-ordered, database-friendly ID.
 * Used as the default ID generator for all entities.
 */
export function generateId(): string {
  // @types/node@24 doesn't declare randomUUIDv7 yet — it was added in Node v24.8
  return (crypto as any).randomUUIDv7();
}
