CREATE TABLE IF NOT EXISTS "notification_channels" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "type" text NOT NULL CHECK ("type" IN ('email', 'slack', 'webhook')),
  "from_email" text,
  "from_name" text,
  "recipient_emails" text[] DEFAULT '{}',
  "slack_access_token" text,
  "slack_channel_id" text,
  "slack_user_id" text,
  "slack_connected_at" timestamp,
  "webhook_url" text,
  "webhook_secret" text,
  "webhook_types" text[] DEFAULT '{}',
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_channels_project_name_idx"
  ON "notification_channels" ("project_id", "name");

CREATE INDEX IF NOT EXISTS "notification_channels_org_type_idx"
  ON "notification_channels" ("org_id", "type");

CREATE INDEX IF NOT EXISTS "notification_channels_project_active_idx"
  ON "notification_channels" ("project_id", "is_active");

CREATE TABLE IF NOT EXISTS "alert_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "min_severity" text NOT NULL CHECK ("min_severity" IN ('critical', 'high', 'medium', 'low')),
  "channel_ids" text[] DEFAULT '{}',
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'disabled')),
  "dedupe_window_seconds" integer DEFAULT 300 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "alert_rules_org_project_idx"
  ON "alert_rules" ("org_id", "project_id");

CREATE INDEX IF NOT EXISTS "alert_rules_project_status_idx"
  ON "alert_rules" ("project_id", "status");

CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "url" text NOT NULL,
  "secret" text,
  "types" text[] DEFAULT '{}' CHECK (unnest("types") IS NULL OR "types" && ARRAY['incident.created','incident.updated','incident.resolved','incident.reopened','alert.triggered','alert.resolved','finding.detected','weekly.summary']),
  "is_active" boolean DEFAULT true NOT NULL,
  "last_triggered_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "webhook_endpoints_org_project_idx"
  ON "webhook_endpoints" ("org_id", "project_id");

CREATE INDEX IF NOT EXISTS "webhook_endpoints_project_active_idx"
  ON "webhook_endpoints" ("project_id", "is_active");

CREATE TABLE IF NOT EXISTS "notification_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "channel_id" text REFERENCES "notification_channels"("id") ON DELETE SET NULL,
  "channel_type" text NOT NULL CHECK ("channel_type" IN ('email', 'slack', 'webhook')),
  "incident_id" text,
  "alert_rule_id" text,
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('sent', 'failed', 'pending')),
  "provider_message_id" text,
  "error" text,
  "payload" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "notification_logs_org_created_idx"
  ON "notification_logs" ("org_id", "created_at");

CREATE INDEX IF NOT EXISTS "notification_logs_project_status_idx"
  ON "notification_logs" ("project_id", "status");

CREATE INDEX IF NOT EXISTS "notification_logs_incident_idx"
  ON "notification_logs" ("incident_id");

CREATE TABLE IF NOT EXISTS "incident_timeline_events" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "incident_id" text NOT NULL,
  "type" text NOT NULL CHECK ("type" IN ('created','updated','resolved','reopened','assigned','unassigned','comment','notification_sent','severity_changed')),
  "actor_id" text,
  "actor_name" text,
  "message" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "incident_timeline_events_incident_idx"
  ON "incident_timeline_events" ("incident_id");

CREATE INDEX IF NOT EXISTS "incident_timeline_events_created_idx"
  ON "incident_timeline_events" ("incident_id", "created_at");

CREATE TABLE IF NOT EXISTS "incident_ownership" (
  "id" text PRIMARY KEY NOT NULL,
  "org_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "incident_id" text NOT NULL,
  "owner_id" text NOT NULL REFERENCES "users"("id") ON DELETE SET NULL,
  "owner_name" text NOT NULL,
  "assigned_at" timestamp DEFAULT now() NOT NULL,
  "assigned_by" text,
  "assigned_by_name" text
);

CREATE UNIQUE INDEX IF NOT EXISTS "incident_ownership_incident_idx"
  ON "incident_ownership" ("incident_id");

CREATE INDEX IF NOT EXISTS "incident_ownership_owner_idx"
  ON "incident_ownership" ("owner_id");