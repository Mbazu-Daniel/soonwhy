ALTER TABLE "ai_provider_credentials" ADD COLUMN IF NOT EXISTS "name" text;
--> statement-breakpoint
ALTER TABLE "ai_provider_credentials" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "ai_provider_credentials" SET "name" = "provider" WHERE "name" IS NULL;
--> statement-breakpoint
UPDATE "ai_provider_credentials" SET "is_default" = true WHERE "deleted_at" IS NULL AND "is_default" = false;
--> statement-breakpoint
ALTER TABLE "ai_provider_credentials" ALTER COLUMN "name" SET NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "ai_provider_credentials_org_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_provider_credentials_org_name_unique"
  ON "ai_provider_credentials" ("org_id", lower("name")) WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_provider_credentials_org_default_unique"
  ON "ai_provider_credentials" ("org_id") WHERE "is_default" AND "deleted_at" IS NULL;
