CREATE UNIQUE INDEX IF NOT EXISTS "projects_organization_id_name_idx" ON "projects" ("organization_id", "name");

CREATE UNIQUE INDEX IF NOT EXISTS "projects_organization_id_slug_idx" ON "projects" ("organization_id", "slug");
