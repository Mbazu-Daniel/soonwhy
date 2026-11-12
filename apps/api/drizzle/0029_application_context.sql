CREATE TABLE IF NOT EXISTS "teams" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "teams_org_slug_idx" ON "teams" ("org_id", "slug");

CREATE TABLE IF NOT EXISTS "environments" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "kind" text NOT NULL DEFAULT 'production',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "environments_project_slug_idx" ON "environments" ("project_id", "slug");

ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "org_id" text;
UPDATE "services" s
SET "org_id" = p."org_id"
FROM "projects" p
WHERE p."id" = s."project_id" AND s."org_id" IS NULL;
ALTER TABLE "services" ALTER COLUMN "org_id" SET NOT NULL;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "language" text;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "framework" text;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "repository_url" text;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "repository_provider" text;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "repository_branch" text;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "owner_id" text REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "team_id" text REFERENCES "teams"("id") ON DELETE SET NULL;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
ALTER TABLE "services" ADD CONSTRAINT "services_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "services_project_slug_idx" ON "services" ("project_id", "slug");

CREATE TABLE IF NOT EXISTS "deployments" (
  "id" text PRIMARY KEY NOT NULL,
  "service_id" text NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
  "environment_id" text NOT NULL REFERENCES "environments"("id") ON DELETE CASCADE,
  "version" text,
  "commit_sha" text,
  "status" text NOT NULL DEFAULT 'active',
  "deployed_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "deployments_service_environment_idx" ON "deployments" ("service_id", "environment_id");
