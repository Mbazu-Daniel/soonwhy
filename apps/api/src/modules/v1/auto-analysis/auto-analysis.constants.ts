export const DEFAULT_DAILY_CAP = 20;
export const DEFAULT_MIN_OCCURRENCES = 5;
export const MAX_DAILY_CAP = 200;
export const MAX_MIN_OCCURRENCES = 1000;
export const SCAN_GROUP_LIMIT = 50;
export const AUTO_ANALYSIS_CRON_NAME = "auto-analysis";
export const AUTO_ANALYSIS_LEASE_MS = 10 * 60 * 1000;
export const NEVER_ANALYZED_STATUS = 404;
export const SERVER_ERROR_FLOOR = 500;
export const EVIDENCE_LABELS_THAT_DEFINE_A_CAUSE: readonly RegExp[] = [
  /^Application frames$/,
  /^Cause \d+$/,
  /^Stack trace$/,
  /^Exception in linked trace$/,
];
