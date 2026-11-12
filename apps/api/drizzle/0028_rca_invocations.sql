CREATE TABLE IF NOT EXISTS "rca_invocations" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "public"."organizations"("id") ON DELETE cascade,
  "project_id" text NOT NULL REFERENCES "public"."projects"("id") ON DELETE cascade,
  "finding_id" text NOT NULL REFERENCES "public"."findings"("id") ON DELETE cascade,
  "status" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "prompt_version" text NOT NULL,
  "request_duration_ms" integer NOT NULL,
  "retries" integer NOT NULL,
  "input_tokens" integer,
  "output_tokens" integer,
  "total_tokens" integer,
  "estimated_cost_usd" real,
  "error_code" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "rca_invocations_org_project_finding_idx"
  ON "rca_invocations" USING btree ("org_id", "project_id", "finding_id");
CREATE INDEX IF NOT EXISTS "rca_invocations_created_at_idx"
  ON "rca_invocations" USING btree ("created_at");
