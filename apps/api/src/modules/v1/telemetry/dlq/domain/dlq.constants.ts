export const REPLAY_LEASE_SECONDS = 300;
export const REPLAY_MESSAGE_ID_PREFIX = "dlq-replay";

export const DLQ_REPLAY_STATUS = {
  pending: "pending",
  replaying: "replaying",
  succeeded: "succeeded",
  failed: "failed",
} as const;

export const BULK_MAX_IDS = 100;
export const BULK_REPLAY_CONCURRENCY = 5;

export const CLEANUP_DEFAULT_DAYS = 7;
export const CLEANUP_MIN_DAYS = 1;
export const CLEANUP_MAX_DAYS = 365;

export const MAX_REPLAY_ATTEMPTS = 5;
export const SYSTEM_ACTOR = "system";

export const DLQ_ATTEMPT_OUTCOME = {
  started: "started",
  succeeded: "succeeded",
  failed: "failed",
  abandoned: "abandoned",
} as const;
