import { QUICKWIT_INDEXES } from "@soonwhy/shared";

export const RETENTION_DATA_TYPES = ["logs", "traces", "metrics", "requests"] as const;
export const MAX_RETENTION_DAYS = 3650;

export const QUICKWIT_INDEX_BY_DATA_TYPE: Record<string, string> = {
  logs: QUICKWIT_INDEXES.logs,
  traces: QUICKWIT_INDEXES.traces,
  metrics: QUICKWIT_INDEXES.metrics,
  requests: QUICKWIT_INDEXES.requests,
};

export const CLEANUP_INTERVAL_HOURS: Record<string, number> = {
  hourly: 1,
  daily: 24,
  weekly: 24 * 7,
};

export const RETENTION_TIMESTAMP_FIELD = "timestamp";
