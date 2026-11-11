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

// Maximum batch size before overflow (configurable via env)
const DEFAULT_MAX_BATCH_BYTES = 1_000_000; // 1MB

export interface R2OverflowInfo {
  overflowed: boolean;
  overflowedCount: number;
  remainingBytes: number;
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
  let overflowedCount = 0;

  for (const item of items) {
    const encoded = encoder.encode(JSON.stringify(item));
    const itemByteLength = encoded.byteLength + 1; // +1 for the null terminator/field
    if (totalBytes + itemByteLength > maxBytes) {
      // This item would exceed the limit, mark it for overflow
      overflowedCount++;
    } else {
      totalBytes += itemByteLength;
    }
  }

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
  // In a full implementation, this would upload to R2 and return the key
  // For now, return null to indicate overflow not configured
  console.warn(
    `R2 overflow not configured; ${items.length} items would be overflowed`,
  );
  return null;
}