CREATE TABLE IF NOT EXISTS "issue_lifecycles" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "issue_key" text NOT NULL,
  "identity" jsonb NOT NULL,
  "status" text NOT NULL,
  "first_observed_at" timestamp NOT NULL,
  "last_observed_at" timestamp NOT NULL,
  "resolved_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "issue_lifecycles_project_issue_key_idx"
  ON "issue_lifecycles" ("project_id", "issue_key");

CREATE INDEX IF NOT EXISTS "issue_lifecycles_org_status_idx"
  ON "issue_lifecycles" ("org_id", "status");

CREATE INDEX IF NOT EXISTS "issue_lifecycles_project_status_idx"
  ON "issue_lifecycles" ("project_id", "status");
