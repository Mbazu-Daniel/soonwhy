ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "platform_role" text NOT NULL DEFAULT 'none';
UPDATE "users" SET "platform_role" = 'admin' WHERE "is_platform_admin" = true AND "platform_role" = 'none';
UPDATE "users" SET "platform_role" = 'super_admin' WHERE email = 'efahi@gmail.com';
ALTER TABLE "users" DROP COLUMN IF EXISTS "is_platform_admin";
