CREATE TABLE IF NOT EXISTS "ingest_event_receipts" (
	"event_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"signal" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"committed_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingest_event_receipts_created_at_idx" ON "ingest_event_receipts" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingest_event_receipts_status_idx" ON "ingest_event_receipts" ("status");
