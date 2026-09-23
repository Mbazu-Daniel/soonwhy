CREATE TABLE IF NOT EXISTS "investigation_cases" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "finding_id" text NOT NULL REFERENCES "findings"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'open',
  "service_name" text NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "evidence" jsonb NOT NULL,
  "evidence_snapshot" jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "investigation_cases_status_check" CHECK ("status" IN ('open', 'investigating', 'resolved', 'closed'))
);

CREATE INDEX IF NOT EXISTS "investigation_cases_project_created_idx"
  ON "investigation_cases" ("project_id", "created_at");
CREATE INDEX IF NOT EXISTS "investigation_cases_finding_status_idx"
  ON "investigation_cases" ("finding_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "investigation_cases_open_finding_unique"
  ON "investigation_cases" ("finding_id")
  WHERE "status" = 'open';

CREATE OR REPLACE FUNCTION prevent_investigation_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.evidence_snapshot IS DISTINCT FROM OLD.evidence_snapshot THEN
    RAISE EXCEPTION 'investigation evidence snapshot is immutable';
  END IF;
  IF NEW.evidence IS DISTINCT FROM OLD.evidence THEN
    RAISE EXCEPTION 'investigation evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS investigation_evidence_immutable ON "investigation_cases";
CREATE TRIGGER investigation_evidence_immutable
BEFORE UPDATE ON "investigation_cases"
FOR EACH ROW
EXECUTE FUNCTION prevent_investigation_evidence_mutation();
