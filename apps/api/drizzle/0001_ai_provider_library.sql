DROP INDEX IF EXISTS "ai_provider_credentials_org_unique";--> statement-breakpoint
ALTER TABLE "ai_provider_credentials" ADD COLUMN IF NOT EXISTS "name" text;--> statement-breakpoint
ALTER TABLE "ai_provider_credentials" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "ai_provider_credentials" SET "name" = "provider" WHERE "name" IS NULL;--> statement-breakpoint
UPDATE "ai_provider_credentials" SET "is_default" = true
WHERE "id" IN (
  SELECT DISTINCT ON ("org_id") "id" FROM "ai_provider_credentials" AS "candidate"
  WHERE "candidate"."deleted_at" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM "ai_provider_credentials" AS "chosen"
      WHERE "chosen"."org_id" = "candidate"."org_id" AND "chosen"."is_default" AND "chosen"."deleted_at" IS NULL
    )
  ORDER BY "org_id", "created_at" NULLS LAST, "id"
);--> statement-breakpoint
ALTER TABLE "ai_provider_credentials" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_provider_credentials_org_name_unique" ON "ai_provider_credentials" USING btree ("org_id",lower("name")) WHERE "ai_provider_credentials"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_provider_credentials_org_default_unique" ON "ai_provider_credentials" USING btree ("org_id") WHERE "ai_provider_credentials"."is_default" and "ai_provider_credentials"."deleted_at" is null;
