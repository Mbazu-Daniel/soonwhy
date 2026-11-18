ALTER TABLE "project_settings" ADD COLUMN "status_page_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
INSERT INTO "project_settings" ("project_id", "status_page_public")
SELECT DISTINCT "project_id", true FROM "synthetic_probes" WHERE "project_id" IN (SELECT "id" FROM "projects")
ON CONFLICT ("project_id") DO UPDATE SET "status_page_public" = true;
