export type IngestConsumerHealth = {
  subject: string;
  durable: string;
  pending: number;
  ackPending: number;
  redelivered: number;
};

export type IngestStatsHealth = {
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

export type IngestCapacityHealth = {
  limit: number;
  perOrganizationLimit: number;
  inFlight: number;
  available: number;
  isSaturated: boolean;
  organizations: number;
};

export type IngestHealthSnapshot = {
  available: boolean;
  stats: IngestStatsHealth;
  capacity: IngestCapacityHealth | null;
  consumers: IngestConsumerHealth[];
  error?: string;
};

export type PipelineLagMetrics = {
  quickwitIndexingLagMs: number;
  quickwitPendingDocs: number;
  lastUpdated: string;
};
