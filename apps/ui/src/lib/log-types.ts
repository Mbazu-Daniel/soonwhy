export interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  service: string;
  message: string;
  traceId?: string;
  spanId?: string;
  stackTrace?: string;
  method?: string;
  endpoint?: string;
  status?: number | string;
  duration?: number | string;
  attributes: string | Record<string, unknown>;
}

export interface LogPage {
  data: LogEntry[];
  nextCursor?: string;
  total: number;
}

export interface LogFieldName {
  name: string;
  kind: 'core' | 'attribute';
  count: number;
}

export interface LogFieldValue {
  value: string;
  count: number;
}

export interface HistogramBucket {
  key: number;
  doc_count: number;
}

export interface LogHistogram {
  timeline?: { buckets?: HistogramBucket[] };
  total: number;
}

export interface LogFilterChip {
  field: string;
  value: string;
  negate: boolean;
}
