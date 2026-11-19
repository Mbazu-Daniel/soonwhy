ALTER TABLE "findings" ADD COLUMN "category" text DEFAULT 'performance' NOT NULL;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "fingerprint" text;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "occurrences" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "last_seen_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "resolved_by" text;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "recommendation" text;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "findings_project_fingerprint_uidx" ON "findings" USING btree ("project_id","fingerprint") WHERE "findings"."fingerprint" is not null;--> statement-breakpoint
CREATE INDEX "findings_project_status_idx" ON "findings" USING btree ("project_id","status");
--> statement-breakpoint
UPDATE "findings" SET "category" = 'error' WHERE "type" IN ('error_group', 'error_rate', 'database_error');
