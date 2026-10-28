ALTER TABLE "alert_rules" ALTER COLUMN "project_id" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "alert_rules_org_idx" ON "alert_rules" ("org_id");
