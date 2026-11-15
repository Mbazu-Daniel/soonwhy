export const DEFAULT_PUBLISH_BATCH_SIZE = 500;
export const DEFAULT_PUBLISH_MAX_BYTES = 900_000;
export const MAX_DELIVERY_ATTEMPTS = 5;
export const CLAIM_LEASE_MS = 60_000;
export const DLQ_SUBJECT_PREFIX = "ingest.dlq.";
export function retryDelayMs(deliveryCount: number, random: () => number = Math.random): number {
  const base = 1000 * Math.max(1, deliveryCount);
  return Math.round(base / 2 + random() * (base / 2));
}
