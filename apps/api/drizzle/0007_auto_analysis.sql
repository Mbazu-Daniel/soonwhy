ALTER TABLE "rca_analyses" ADD COLUMN "trigger" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "rca_analyses" ADD COLUMN "evidence_hash" text;--> statement-breakpoint
CREATE TABLE "auto_analysis_settings" (
	"org_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"daily_cap" integer DEFAULT 20 NOT NULL,
	"min_occurrences" integer DEFAULT 5 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auto_analysis_settings" ADD CONSTRAINT "auto_analysis_settings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rca_analyses_org_trigger_idx" ON "rca_analyses" USING btree ("org_id","trigger","created_at");
