CREATE TABLE "dead_letter_queue_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"attempt_number" integer NOT NULL,
	"triggered_by" text NOT NULL,
	"forced" boolean DEFAULT false NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"outcome" text DEFAULT 'started' NOT NULL,
	"error" text,
	CONSTRAINT "dead_letter_queue_attempts_outcome_check" CHECK ("dead_letter_queue_attempts"."outcome" in ('started', 'succeeded', 'failed', 'abandoned'))
);--> statement-breakpoint
CREATE UNIQUE INDEX "dead_letter_queue_attempts_entry_attempt_uidx" ON "dead_letter_queue_attempts" USING btree ("entry_id","attempt_number");--> statement-breakpoint
CREATE FUNCTION "dead_letter_queue_attempts_append_only"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'dead_letter_queue_attempts is append-only';
  END IF;
  IF OLD.outcome <> 'started'
     OR NEW.id <> OLD.id
     OR NEW.entry_id <> OLD.entry_id
     OR NEW.attempt_number <> OLD.attempt_number
     OR NEW.triggered_by <> OLD.triggered_by
     OR NEW.started_at <> OLD.started_at THEN
    RAISE EXCEPTION 'dead_letter_queue_attempts rows can only be completed once';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "dead_letter_queue_attempts_append_only" BEFORE UPDATE OR DELETE ON "dead_letter_queue_attempts" FOR EACH ROW EXECUTE FUNCTION "dead_letter_queue_attempts_append_only"();
