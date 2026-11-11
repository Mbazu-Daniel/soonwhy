CREATE TABLE IF NOT EXISTS "alert_triggers" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"alert_rule_id" text NOT NULL,
	"alert_name" text NOT NULL,
	"triggered_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"severity" text NOT NULL,
	"streak_count" integer DEFAULT 1 NOT NULL,
	"last_streak_reset_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_triggers_org_project_idx" ON "alert_triggers" ("org_id", "project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_triggers_alert_rule_idx" ON "alert_triggers" ("alert_rule_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_triggers_triggered_at_idx" ON "alert_triggers" ("triggered_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alert_triggers_status_idx" ON "alert_triggers" ("status");
