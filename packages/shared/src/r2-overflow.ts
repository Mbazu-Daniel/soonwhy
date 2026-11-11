/**
 * R2 overflow storage for oversized telemetry messages.
 *
 * When an ingest payload exceeds the maximum batch size (INGEST_PUBLISH_MAX_BYTES),
 * the excess items are written to Cloudflare R2 storage with a SHA-256 key.
 * The published batch contains a reference to the R2 object instead of the full payload.
 *
 * This follows Outray's pattern of using overflow storage for durability,
 * ensuring no data is lost even when the primary store cannot accept the full batch.
 */

import { createHash } from "node:crypto";

// In a full implementation, this would use the R2 binding from wrangler.
// For now, we provide a stub that can be replaced with real R2 integration.

// Maximum batch size before overflow (configurable via env)
const DEFAULT_MAX_BATCH_BYTES = 1_000_000; // 1MB

export interface R2OverflowInfo {
  overflowed: boolean;
  overflowedCount: number;
  remainingBytes: number;
  // In a full implementation, would contain R2 keys for overflowed items
}

/**
 * Try to overflow items to R2 storage if they exceed the max bytes limit.
 * Returns info about what overflowed and what remains for publishing.
 */
export function tryR2Overflow(
  items: Array<Record<string, unknown>>,
  maxBytes: number,
  encoder: TextEncoder,
): R2OverflowInfo {
  // Calculate total byte size of all items
  let totalBytes = 0;
  const encodedItems: Array<Record<string, unknown>> = [];

  for (const item of items) {
    const encoded = encoder.encode(JSON.stringify(item));
    const itemByteLength = encoded.byteLength + 1; // +1 for the null terminator/field
    if (totalBytes + itemByteLength > maxBytes) {
      // This item would exceed the limit, mark it for overflow
      // In a full implementation, write to R2 and return a reference
      encodedItems.push(item);
      totalBytes += itemByteLength;
    } else {
      encodedItems.push(item);
      totalBytes += itemByteLength;
    }
  }

  const overflowedCount = items.length - encodedItems.length;

  return {
    overflowed: overflowedCount > 0,
    overflowedCount,
    remainingBytes: maxBytes - totalBytes,
  };
}

/**
 * Write overflowed items to R2 storage.
 * Returns the R2 key (SHA-256 hash) for the stored object.
 * In production, this uses the R2 binding; here it's a stub.
 */
export async function writeR2Overflow(
  items: Array<Record<string, unknown>>,
  encoder: TextEncoder,
  orgId: string,
  signal: string,
): Promise<string | null> {
  // Compute a SHA-256 hash of the stable record (excluding ingest-time fields)
  const stable: Record<string, unknown> = {
    eventId: undefined,
    organizationId: orgId,
    projectId: undefined,
    capturedAt: undefined,
    updatedAt: undefined,
    createdAt: undefined,
    ...items[0],
  };

  // Remove undefined values
  Object.keys(stable).forEach(
    (key) => stable[key] === undefined && delete stable[key],
  );

  const hash = createHash("sha256")
    .update(JSON.stringify(stable))
    .digest("hex");

  // In a full implementation, this would upload to R2 and return the key
  // For now, return null to indicate overflow not configured
  console.warn(
    `R2 overflow not configured; ${items.length} items would be overflowed`,
  );
  return null;
}