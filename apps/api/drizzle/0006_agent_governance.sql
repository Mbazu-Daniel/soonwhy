CREATE TABLE IF NOT EXISTS agent_policies (
  id text PRIMARY KEY NOT NULL,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  allowed_tools jsonb NOT NULL,
  max_requests_per_minute integer NOT NULL DEFAULT 30,
  max_tokens_per_investigation integer NOT NULL DEFAULT 20000,
  max_cost_usd_per_investigation real NOT NULL DEFAULT 1,
  redact_sensitive_data boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_policies_org_user_idx
  ON agent_policies (org_id, user_id);

CREATE TABLE IF NOT EXISTS agent_audit_events (
  id text PRIMARY KEY NOT NULL,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  investigation_id text REFERENCES investigation_cases(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  tool_name text,
  model text,
  status text NOT NULL,
  tokens integer,
  cost_usd real,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_audit_events_org_investigation_idx
  ON agent_audit_events (org_id, investigation_id, created_at);
