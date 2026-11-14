CREATE TABLE IF NOT EXISTS "error_issue_states" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL,
  "project_id" text NOT NULL,
  "fingerprint" text NOT NULL,
  "status" text NOT NULL,
  "resolved_at" timestamp,
  "updated_by" text,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "error_issue_states_org_id_organizations_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade,
  CONSTRAINT "error_issue_states_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade,
  CONSTRAINT "error_issue_states_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "error_issue_states_key"
  ON "error_issue_states" ("org_id", "project_id", "fingerprint");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_issue_states_project_idx"
  ON "error_issue_states" ("org_id", "project_id");
