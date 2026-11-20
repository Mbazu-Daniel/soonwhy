CREATE TABLE "dependency_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"service_name" text NOT NULL,
	"ecosystem" text NOT NULL,
	"packages" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_scanned_at" timestamp,
	"last_scan_error" text
);
--> statement-breakpoint
ALTER TABLE "dependency_snapshots" ADD CONSTRAINT "dependency_snapshots_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dependency_snapshots" ADD CONSTRAINT "dependency_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "dependency_snapshots_service_uidx" ON "dependency_snapshots" USING btree ("project_id","service_name","ecosystem");
--> statement-breakpoint
CREATE INDEX "dependency_snapshots_scan_idx" ON "dependency_snapshots" USING btree ("last_scanned_at");
