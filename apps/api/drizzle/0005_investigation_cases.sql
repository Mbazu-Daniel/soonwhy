CREATE TABLE IF NOT EXISTS "investigation_cases" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "finding_id" text NOT NULL REFERENCES "findings"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'open',
  "service_name" text NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "evidence" jsonb NOT NULL,
  "evidence_snapshot" jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "investigation_cases_project_created_idx"
  ON "investigation_cases" ("project_id", "created_at");
CREATE INDEX IF NOT EXISTS "investigation_cases_finding_status_idx"
  ON "investigation_cases" ("finding_id", "status");
