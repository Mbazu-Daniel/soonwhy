DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "detection_runs"
    WHERE "window_start" >= "window_end"
  ) THEN
    RAISE EXCEPTION 'Cannot add detection window constraint: invalid existing windows';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "detection_runs"
    WHERE "findings_count" < 0
  ) THEN
    RAISE EXCEPTION 'Cannot add detection findings constraint: negative existing counts';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "detection_runs"
    WHERE "status" NOT IN ('running', 'completed', 'failed')
  ) THEN
    RAISE EXCEPTION 'Cannot add detection status constraint: invalid existing statuses';
  END IF;
END $$;

ALTER TABLE "detection_runs"
  ADD CONSTRAINT "detection_runs_window_order_check"
  CHECK ("window_start" < "window_end"),
  ADD CONSTRAINT "detection_runs_findings_count_check"
  CHECK ("findings_count" >= 0),
  ADD CONSTRAINT "detection_runs_status_check"
  CHECK ("status" IN ('running', 'completed', 'failed'));

CREATE UNIQUE INDEX IF NOT EXISTS "detection_runs_project_window_unique"
  ON "detection_runs" ("project_id", "window_start", "window_end");
