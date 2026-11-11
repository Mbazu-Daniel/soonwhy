CREATE TABLE "dead_letter_investigations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"investigation_id" text NOT NULL,
	"project_id" text NOT NULL,
	"request" jsonb NOT NULL,
	"error" text NOT NULL,
	"attempt_count" text NOT NULL,
	"last_attempt_at" timestamp NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "detector_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"detectors" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"feature_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "notification_logs_idempotency_idx";--> statement-breakpoint
DROP INDEX "usage_events_org_idempotency_unique_idx";--> statement-breakpoint
ALTER TABLE "notification_logs" ALTER COLUMN "idempotency_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "dead_letter_investigations" ADD CONSTRAINT "dead_letter_investigations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detector_settings" ADD CONSTRAINT "detector_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dl_investigations_org_idx" ON "dead_letter_investigations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "dl_investigations_project_idx" ON "dead_letter_investigations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "dl_investigations_investigation_idx" ON "dead_letter_investigations" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "dl_investigations_expires_idx" ON "dead_letter_investigations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "alert_triggers_dedupe_idx" ON "alert_triggers" USING btree ("alert_rule_id","org_id","project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_events_org_idempotency_unique_idx" ON "usage_events" USING btree ("org_id","idempotency_key") WHERE "usage_events"."idempotency_key" IS NOT NULL;