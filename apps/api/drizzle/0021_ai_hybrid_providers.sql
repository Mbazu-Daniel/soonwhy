ALTER TABLE "rca_invocations" ADD COLUMN IF NOT EXISTS "credential_source" text;
ALTER TABLE "rca_invocations" ADD COLUMN IF NOT EXISTS "credential_id" text;
ALTER TABLE "rca_analyses" ADD COLUMN IF NOT EXISTS "credential_source" text;
ALTER TABLE "ai_provider_credentials" ADD COLUMN IF NOT EXISTS "enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "ai_provider_credentials" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp without time zone;
ALTER TABLE "ai_provider_credentials" ADD COLUMN IF NOT EXISTS "verified_at" timestamp without time zone;
ALTER TABLE "ai_provider_credentials" ADD COLUMN IF NOT EXISTS "last_error_code" text;
ALTER TABLE "billing_plan_quotas" ADD COLUMN IF NOT EXISTS "org_id" text;
ALTER TABLE "billing_plan_quotas" ALTER COLUMN "plan_id" DROP NOT NULL;
DO $$ BEGIN
  ALTER TABLE "billing_plan_quotas" ADD CONSTRAINT "billing_plan_quotas_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "billing_plan_quotas" ADD CONSTRAINT "billing_plan_quotas_scope_check" CHECK ("plan_id" IS NOT NULL OR "org_id" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "billing_plan_quotas_org_metric_unique_idx" ON "billing_plan_quotas" USING btree ("org_id","metric") WHERE "org_id" IS NOT NULL;
