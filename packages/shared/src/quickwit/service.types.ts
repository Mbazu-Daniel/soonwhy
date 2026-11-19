export interface QuickwitHit<T> {
  _source?: T;
  [key: string]: unknown;
}

export interface QuickwitSearchResponse<T> {
  hits: QuickwitHit<T>[];
  num_hits: number;
  elapsed_time_micros: number;
  aggregations?: Record<string, unknown>;
}

export interface QuickwitSearchInput {
  query: string;
  startTimestamp?: number;
  endTimestamp?: number;
  maxHits?: number;
  startOffset?: number;
  sortBy?: string[];
  searchField?: string[];
  aggregations?: Record<string, unknown>;
}

export interface QuickwitIndexDescription {
  index_id: string;
  num_published_splits: number;
  size_published_splits: number;
  num_published_docs: number;
  size_published_docs_uncompressed: number;
  min_timestamp?: number | null;
  max_timestamp?: number | null;
}

export interface QuickwitSplit {
  split_state: string;
  update_timestamp?: number;
  publish_timestamp?: number | null;
  num_docs?: number;
  footer_offsets?: { start: number; end: number };
  maturity?: { type: string; maturation_period_millis?: number };
}
