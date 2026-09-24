CREATE TABLE IF NOT EXISTS "rca_analyses" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL,
  "project_id" text NOT NULL,
  "finding_id" text NOT NULL,
  "service_name" text NOT NULL,
  "severity" text NOT NULL,
  "summary" text NOT NULL,
  "root_cause" text NOT NULL,
  "contributing_factors" jsonb NOT NULL,
  "investigation_steps" jsonb NOT NULL,
  "suggested_changes" jsonb NOT NULL,
  "evidence_refs" jsonb NOT NULL,
  "limitations" jsonb NOT NULL,
  "confidence" text NOT NULL,
  "evidence_snapshot" jsonb NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "prompt_version" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "rca_analyses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade,
  CONSTRAINT "rca_analyses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade,
  CONSTRAINT "rca_analyses_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "rca_analyses_org_project_finding_idx" ON "rca_analyses" USING btree ("org_id", "project_id", "finding_id");
CREATE INDEX IF NOT EXISTS "rca_analyses_created_at_idx" ON "rca_analyses" USING btree ("created_at");
