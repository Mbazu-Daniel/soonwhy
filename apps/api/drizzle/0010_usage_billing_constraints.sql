DROP INDEX IF EXISTS usage_events_org_idempotency_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS usage_events_org_idempotency_unique_idx
  ON usage_events (org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS billing_events_org_external_event_idx
  ON billing_events (org_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

ALTER TABLE billing_plan_quotas
  ADD CONSTRAINT billing_plan_quotas_limit_non_negative
  CHECK ("limit" IS NULL OR "limit" >= 0);

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_period_valid
  CHECK (current_period_start < current_period_end);

ALTER TABLE usage_events
  ADD CONSTRAINT usage_events_quantity_positive
  CHECK (quantity > 0);

ALTER TABLE usage_periods
  ADD CONSTRAINT usage_periods_quantity_non_negative
  CHECK (quantity >= 0);

ALTER TABLE usage_periods
  ADD CONSTRAINT usage_periods_period_valid
  CHECK (period_start < period_end);

ALTER TABLE billing_events
  ADD CONSTRAINT billing_events_quantity_non_negative
  CHECK (quantity IS NULL OR quantity >= 0);

ALTER TABLE billing_events
  ADD CONSTRAINT billing_events_period_valid
  CHECK (
    period_start IS NULL
    OR period_end IS NULL
    OR period_start < period_end
  );
