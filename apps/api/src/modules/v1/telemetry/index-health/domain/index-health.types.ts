export type IndexStatus = "healthy" | "stale" | "empty" | "unavailable";

export interface SplitSummary {
  published: number;
  staged: number;
  markedForDeletion: number;
  immature: number;
  lastPublishedAt: string | null;
  truncated: boolean;
}

export interface IndexHealth {
  indexId: string;
  status: IndexStatus;
  documents: number;
  sizeBytes: number;
  uncompressedBytes: number;
  oldestEventAt: string | null;
  newestEventAt: string | null;
  splits: SplitSummary;
  error?: string;
}

export interface IndexHealthSnapshot {
  indexes: IndexHealth[];
  staleAfterMinutes: number;
  checkedAt: string;
}
