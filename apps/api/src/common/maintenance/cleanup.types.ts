export const CLEANUP_RETENTION_DAYS = {
  ingestReceipts: 7,
  deadLetters: 30,
  notificationLogs: 90,
  detectionRuns: 30,
} as const;

export interface CleanupTableResult {
  table: string;
  deleted: number;
  error?: string;
}

export interface CleanupReport {
  startedAt: string;
  finishedAt: string;
  results: CleanupTableResult[];
  deletedTotal: number;
}
