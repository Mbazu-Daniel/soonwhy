ALTER TABLE "usage_events" DROP CONSTRAINT "usage_events_project_id_projects_id_fk";--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_periods" DROP CONSTRAINT "usage_periods_project_id_projects_id_fk";--> statement-breakpoint
ALTER TABLE "usage_periods" ADD CONSTRAINT "usage_periods_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_events_project_idx" ON "usage_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_periods_project_idx" ON "usage_periods" USING btree ("project_id");
