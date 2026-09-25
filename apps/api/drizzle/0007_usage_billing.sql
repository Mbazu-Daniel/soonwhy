CREATE TABLE IF NOT EXISTS billing_plans (
  id text PRIMARY KEY NOT NULL,
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_plan_quotas (
  id text PRIMARY KEY NOT NULL,
  plan_id text NOT NULL REFERENCES billing_plans(id) ON DELETE CASCADE,
  metric text NOT NULL,
  "limit" bigint,
  unit text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_plan_quotas_plan_metric_idx
  ON billing_plan_quotas (plan_id, metric);

CREATE TABLE IF NOT EXISTS subscriptions (
  id text PRIMARY KEY NOT NULL,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES billing_plans(id),
  status text NOT NULL,
  trial_ends_at timestamp,
  current_period_start timestamp NOT NULL,
  current_period_end timestamp NOT NULL,
  external_customer_id text,
  external_subscription_id text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_org_idx ON subscriptions (org_id);

CREATE TABLE IF NOT EXISTS usage_events (
  id text PRIMARY KEY NOT NULL,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  metric text NOT NULL,
  quantity bigint NOT NULL,
  source text NOT NULL,
  idempotency_key text,
  occurred_at timestamp NOT NULL DEFAULT now(),
  metadata jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS usage_events_org_idempotency_idx
  ON usage_events (org_id, idempotency_key);

CREATE TABLE IF NOT EXISTS usage_periods (
  id text PRIMARY KEY NOT NULL,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE CASCADE,
  metric text NOT NULL,
  period_start timestamp NOT NULL,
  period_end timestamp NOT NULL,
  quantity bigint NOT NULL DEFAULT 0,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS usage_periods_scope_metric_period_idx
  ON usage_periods (org_id, project_id, metric, period_start, period_end);

CREATE TABLE IF NOT EXISTS billing_events (
  id text PRIMARY KEY NOT NULL,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL,
  metric text,
  quantity bigint,
  period_start timestamp,
  period_end timestamp,
  external_event_id text,
  status text NOT NULL,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
