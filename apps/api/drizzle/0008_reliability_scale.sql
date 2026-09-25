CREATE INDEX IF NOT EXISTS "usage_events_org_occurred_metric_idx"
  ON "usage_events" ("org_id", "occurred_at", "metric");

CREATE INDEX IF NOT EXISTS "billing_events_org_created_idx"
  ON "billing_events" ("org_id", "created_at");

CREATE INDEX IF NOT EXISTS "detection_runs_project_window_idx"
  ON "detection_runs" ("project_id", "window_start", "window_end");
