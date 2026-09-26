CREATE TABLE IF NOT EXISTS "project_settings" (
  "project_id" text PRIMARY KEY NOT NULL,
  "redact_sensitive_data" boolean DEFAULT true NOT NULL,
  "capture_request_headers" boolean DEFAULT false NOT NULL,
  "capture_request_body" boolean DEFAULT false NOT NULL,
  "capture_response_body" boolean DEFAULT false NOT NULL,
  "max_attribute_count" integer DEFAULT 100 NOT NULL,
  "max_attribute_value_length" integer DEFAULT 4096 NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE "project_settings" ADD CONSTRAINT "project_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
