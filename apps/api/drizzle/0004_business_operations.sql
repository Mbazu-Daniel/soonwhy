CREATE TABLE IF NOT EXISTS "business_operations" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "service_id" text NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
  "environment_id" text REFERENCES "environments"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "method" text,
  "route_pattern" text,
  "criticality" text NOT NULL DEFAULT 'medium',
  "slo_metric" text,
  "slo_target" real,
  "slo_unit" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "business_operations_project_idx"
  ON "business_operations" ("project_id");
CREATE INDEX IF NOT EXISTS "business_operations_service_idx"
  ON "business_operations" ("service_id");
CREATE INDEX IF NOT EXISTS "business_operations_org_project_slug_idx"
  ON "business_operations" ("org_id", "project_id", "slug");
