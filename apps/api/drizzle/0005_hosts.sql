CREATE TABLE "hosts" (
	"id" text PRIMARY KEY NOT NULL,
	"host_name" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hosts" ADD CONSTRAINT "hosts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosts" ADD CONSTRAINT "hosts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hosts_host_name_idx" ON "hosts" USING btree ("host_name");--> statement-breakpoint
CREATE INDEX "hosts_project_id_idx" ON "hosts" USING btree ("project_id");