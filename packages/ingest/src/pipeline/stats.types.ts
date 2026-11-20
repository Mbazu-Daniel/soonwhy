export type IngestStatsSnapshot = {
  accepted: number;
  rejected: number;
  published: number;
  inserted: number;
  duplicates: number;
  dlq: number;
  errors: number;
  averageLatencyMs: number;
  eventsPerSecond: number;
  inFlight: number;
  peakInFlight: number;
};
