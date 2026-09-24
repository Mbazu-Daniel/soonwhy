ALTER TABLE agent_policies
  ADD CONSTRAINT agent_policies_requests_positive CHECK (max_requests_per_minute > 0),
  ADD CONSTRAINT agent_policies_tokens_positive CHECK (max_tokens_per_investigation > 0),
  ADD CONSTRAINT agent_policies_cost_non_negative CHECK (max_cost_usd_per_investigation >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS agent_policies_org_default_idx
  ON agent_policies (org_id)
  WHERE user_id IS NULL;

DROP INDEX IF EXISTS agent_policies_org_user_idx;

CREATE UNIQUE INDEX IF NOT EXISTS agent_policies_org_user_idx
  ON agent_policies (org_id, user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE agent_audit_events
  ADD CONSTRAINT agent_audit_events_tokens_non_negative CHECK (tokens IS NULL OR tokens >= 0),
  ADD CONSTRAINT agent_audit_events_cost_non_negative CHECK (cost_usd IS NULL OR cost_usd >= 0),
  ADD CONSTRAINT agent_audit_events_event_type CHECK (
    event_type IN ('tool_authorized', 'tool_denied', 'tool_completed', 'tool_failed')
  ),
  ADD CONSTRAINT agent_audit_events_status CHECK (
    status IN ('allowed', 'denied', 'completed', 'failed')
  );
