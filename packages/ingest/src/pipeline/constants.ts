import { QUICKWIT_DEFAULT_COMMIT_TIMEOUT_SECS } from "@soonwhy/shared";

export const DEFAULT_PUBLISH_BATCH_SIZE = 500;
export const DEFAULT_PUBLISH_MAX_BYTES = 900_000;
export const MAX_DELIVERY_ATTEMPTS = 5;
export const LEASE_COMMIT_TIMEOUT_MULTIPLIER = 2;
export const LEASE_MARGIN_MS = 30_000;
export const RECONCILE_CHUNK_SIZE = 500;
export function leaseMsForCommitTimeout(commitTimeoutSecs: number): number {
  return commitTimeoutSecs * 1000 * LEASE_COMMIT_TIMEOUT_MULTIPLIER + LEASE_MARGIN_MS;
}
export const CLAIM_LEASE_MS = leaseMsForCommitTimeout(QUICKWIT_DEFAULT_COMMIT_TIMEOUT_SECS);
export const DLQ_SUBJECT_PREFIX = "ingest.dlq.";
export function retryDelayMs(deliveryCount: number, random: () => number = Math.random): number {
  const cap = Math.min(30_000, 500 * 2 ** Math.max(0, Math.floor(deliveryCount) - 1));
  return Math.round(random() * cap);
}
export const MAX_INGEST_BODY_BYTES = 8 * 1024 * 1024;
export const MAX_INGEST_DECODED_BYTES = 32 * 1024 * 1024;
export const REJECTED_DOCS_ALERT_THRESHOLD_DEFAULT = 10;
export const REJECTED_DOCS_DLQ_DELIVERY_COUNT = 1;

export const DUPLICATE_CHECK_INTERVAL_MS_DEFAULT = 10 * 60_000;
export const DUPLICATE_CHECK_WINDOW_SECS_DEFAULT = 60 * 60;
export const ALERT_COOLDOWN_MS = 15 * 60_000;
export const ALERT_WEBHOOK_TIMEOUT_MS = 5_000;
