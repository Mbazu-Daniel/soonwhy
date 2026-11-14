ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "public_id" text;
--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "public_id" text;
--> statement-breakpoint
ALTER TABLE "investigation_cases" ADD COLUMN IF NOT EXISTS "public_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "services_public_id_idx" ON "services" ("public_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_public_id_idx" ON "invitations" ("public_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "investigation_cases_public_id_idx" ON "investigation_cases" ("public_id");
