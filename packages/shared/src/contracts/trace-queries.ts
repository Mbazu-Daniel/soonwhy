export type QueryHintKind = "repeated" | "index" | "unfiltered";

export type QueryHint = { kind: QueryHintKind; message: string };

export type TraceQuery = {
  query: string;
  operation: string;
  table: string | null;
  filterColumns: string[];
  count: number;
  totalMs: number;
  maxMs: number;
  avgMs: number;
  shareOfTrace: number;
  spanId: string;
  hints: QueryHint[];
};

export type TraceQuerySummary = {
  queryCount: number;
  totalQueryMs: number;
  traceMs: number;
  queries: TraceQuery[];
};
