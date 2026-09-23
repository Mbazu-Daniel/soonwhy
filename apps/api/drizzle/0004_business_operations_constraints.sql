CREATE UNIQUE INDEX IF NOT EXISTS "business_operations_project_slug_unique"
  ON "business_operations" ("project_id", "slug");

ALTER TABLE "business_operations"
  ADD CONSTRAINT "business_operations_criticality_check"
  CHECK ("criticality" IN ('low', 'medium', 'high', 'critical'));

ALTER TABLE "business_operations"
  ADD CONSTRAINT "business_operations_slo_target_check"
  CHECK ("slo_target" IS NULL OR "slo_target" > 0);
