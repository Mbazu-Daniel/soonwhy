export type SinkDuplicateStatus = {
  documents: number;
  duplicateEventIds: number;
  extraCopies: number;
  truncated: boolean;
  windowStart: string;
  windowEnd: string;
  checkedAt: string;
};

export type IngestStatsSnapshot = {
  accepted: number;
  rejected: number;
  published: number;
  inserted: number;
  rejectedDocs: number;
  reconciled: number;
  sinkDuplicates: Record<string, SinkDuplicateStatus>;
  duplicates: number;
  dlq: number;
  errors: number;
  averageLatencyMs: number;
  eventsPerSecond: number;
  inFlight: number;
  peakInFlight: number;
};
