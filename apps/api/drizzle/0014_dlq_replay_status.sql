ALTER TABLE "dead_letter_queue" ADD COLUMN "replay_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "dead_letter_queue" ADD COLUMN "replay_lease_expires_at" timestamp;--> statement-breakpoint
UPDATE "dead_letter_queue" SET "replay_status" = CASE
  WHEN "replayed" = true AND "replay_success" = true THEN 'succeeded'
  WHEN "replayed" = true AND "replay_success" = false THEN 'failed'
  ELSE 'pending'
END;--> statement-breakpoint
ALTER TABLE "dead_letter_queue" ADD CONSTRAINT "dead_letter_queue_replay_status_check" CHECK ("replay_status" in ('pending', 'replaying', 'succeeded', 'failed'));--> statement-breakpoint
CREATE INDEX "dead_letter_queue_replay_status_idx" ON "dead_letter_queue" USING btree ("replay_status");
