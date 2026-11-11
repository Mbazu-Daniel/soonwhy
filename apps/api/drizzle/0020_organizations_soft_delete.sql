ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp without time zone;
