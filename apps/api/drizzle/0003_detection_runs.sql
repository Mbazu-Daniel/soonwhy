CREATE TABLE IF NOT EXISTS "detection_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "window_start" timestamp NOT NULL,
  "window_end" timestamp NOT NULL,
  "status" text NOT NULL,
  "findings_count" integer NOT NULL DEFAULT 0,
  "started_at" timestamp NOT NULL DEFAULT now(),
  "completed_at" timestamp,
  "error" text
);
CREATE INDEX IF NOT EXISTS "detection_runs_project_started_idx"
  ON "detection_runs" ("project_id", "started_at");
