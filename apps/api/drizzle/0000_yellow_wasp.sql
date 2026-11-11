CREATE TABLE "agent_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text,
	"investigation_id" text,
	"event_type" text NOT NULL,
	"tool_name" text,
	"model" text,
	"status" text NOT NULL,
	"tokens" integer,
	"cost_usd" real,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_audit_events_tokens_non_negative" CHECK ("agent_audit_events"."tokens" IS NULL OR "agent_audit_events"."tokens" >= 0),
	CONSTRAINT "agent_audit_events_cost_non_negative" CHECK ("agent_audit_events"."cost_usd" IS NULL OR "agent_audit_events"."cost_usd" >= 0),
	CONSTRAINT "agent_audit_events_event_type" CHECK ("agent_audit_events"."event_type" IN ('tool_authorized', 'tool_denied', 'tool_completed', 'tool_failed')),
	CONSTRAINT "agent_audit_events_status" CHECK ("agent_audit_events"."status" IN ('allowed', 'denied', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "agent_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text,
	"allowed_tools" jsonb NOT NULL,
	"max_requests_per_minute" integer DEFAULT 30 NOT NULL,
	"max_tokens_per_investigation" integer DEFAULT 20000 NOT NULL,
	"max_cost_usd_per_investigation" real DEFAULT 1 NOT NULL,
	"redact_sensitive_data" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_policies_requests_positive" CHECK ("agent_policies"."max_requests_per_minute" > 0),
	CONSTRAINT "agent_policies_tokens_positive" CHECK ("agent_policies"."max_tokens_per_investigation" > 0),
	CONSTRAINT "agent_policies_cost_non_negative" CHECK ("agent_policies"."max_cost_usd_per_investigation" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ai_provider_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"base_url" text,
	"encrypted_api_key" text NOT NULL,
	"key_hint" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"verified_at" timestamp,
	"last_error_code" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text,
	"name" text NOT NULL,
	"description" text,
	"min_severity" text NOT NULL,
	"channel_ids" text[] DEFAULT '{}',
	"status" text DEFAULT 'active' NOT NULL,
	"dedupe_window_seconds" integer DEFAULT 300 NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" text[] DEFAULT '{}',
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"issuer" text DEFAULT 'local:credential' NOT NULL,
	"provider_user_id" text DEFAULT '' NOT NULL,
	"provider_id" text NOT NULL,
	"password_hash" text,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"organization_id" text,
	"action" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"name" text,
	"avatar" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"email_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"type" text NOT NULL,
	"metric" text,
	"quantity" bigint,
	"period_start" timestamp,
	"period_end" timestamp,
	"external_event_id" text,
	"status" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_events_quantity_non_negative" CHECK ("billing_events"."quantity" IS NULL OR "billing_events"."quantity" >= 0),
	CONSTRAINT "billing_events_period_valid" CHECK ("billing_events"."period_start" IS NULL OR "billing_events"."period_end" IS NULL OR "billing_events"."period_start" < "billing_events"."period_end")
);
--> statement-breakpoint
CREATE TABLE "billing_plan_quotas" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text,
	"org_id" text,
	"metric" text NOT NULL,
	"limit" bigint,
	"unit" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_plan_quotas_limit_non_negative" CHECK ("billing_plan_quotas"."limit" IS NULL OR "billing_plan_quotas"."limit" >= 0),
	CONSTRAINT "billing_plan_quotas_scope_check" CHECK ("billing_plan_quotas"."plan_id" IS NOT NULL OR "billing_plan_quotas"."org_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "billing_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"status" text NOT NULL,
	"trial_ends_at" timestamp,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"external_customer_id" text,
	"external_subscription_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_period_valid" CHECK ("subscriptions"."current_period_start" < "subscriptions"."current_period_end")
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text,
	"metric" text NOT NULL,
	"quantity" bigint NOT NULL,
	"source" text NOT NULL,
	"idempotency_key" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "usage_events_quantity_positive" CHECK ("usage_events"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "usage_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text,
	"metric" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"quantity" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usage_periods_quantity_non_negative" CHECK ("usage_periods"."quantity" >= 0),
	CONSTRAINT "usage_periods_period_valid" CHECK ("usage_periods"."period_start" < "usage_periods"."period_end")
);
--> statement-breakpoint
CREATE TABLE "business_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"service_id" text NOT NULL,
	"environment_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"method" text,
	"route_pattern" text,
	"criticality" text DEFAULT 'medium' NOT NULL,
	"slo_metric" text,
	"slo_target" real,
	"slo_unit" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "canary_deployments" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"deployment_id" text,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"target_url" text NOT NULL,
	"baseline_url" text,
	"validation_rules" jsonb DEFAULT '{}'::jsonb,
	"probe_results" jsonb DEFAULT '[]'::jsonb,
	"metrics" jsonb DEFAULT '{}'::jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dead_letter_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"signal" text NOT NULL,
	"delivery_count" integer NOT NULL,
	"reason" text NOT NULL,
	"failed_at" timestamp DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL,
	"replayed" boolean DEFAULT false NOT NULL,
	"replayed_at" timestamp,
	"replay_success" boolean,
	"replay_attempts" integer DEFAULT 0,
	"replay_error" text,
	"organization_id" text,
	"project_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"environment_id" text NOT NULL,
	"version" text,
	"commit_sha" text,
	"status" text DEFAULT 'active' NOT NULL,
	"deployed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "detection_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL,
	"status" text NOT NULL,
	"findings_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "environments" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"kind" text DEFAULT 'production' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "error_regressions" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"error_message" text NOT NULL,
	"stack_trace" text,
	"service_name" text,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"last_resolved_at" timestamp,
	"resolved_by" text,
	"regression_count" integer DEFAULT 0 NOT NULL,
	"last_regression_at" timestamp,
	"is_regression" boolean DEFAULT false NOT NULL,
	"alert_on_regression" boolean DEFAULT true NOT NULL,
	"regression_notified" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "error_regressions_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"service_id" text,
	"service_name" text NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"observed_value" real NOT NULL,
	"threshold" real NOT NULL,
	"unit" text NOT NULL,
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"evidence" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_ownership" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"incident_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"owner_name" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" text,
	"assigned_by_name" text
);
--> statement-breakpoint
CREATE TABLE "incident_timeline_events" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"incident_id" text NOT NULL,
	"type" text NOT NULL,
	"actor_id" text,
	"actor_name" text,
	"role" text,
	"message" text NOT NULL,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" text NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"alert_rule_id" text NOT NULL,
	"status" text DEFAULT 'firing' NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb,
	"fired_at" timestamp DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp,
	"acknowledged_by" text,
	"acknowledgement_note" text,
	"resolved_at" timestamp,
	"resolved_by" text,
	"resolution_note" text,
	"recovery_notified" boolean DEFAULT false NOT NULL,
	"last_evaluated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "incidents_incident_id_unique" UNIQUE("incident_id")
);
--> statement-breakpoint
CREATE TABLE "ingest_event_receipts" (
	"event_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"signal" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"committed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ingest_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"max_events_per_second" integer DEFAULT 1000 NOT NULL,
	"max_bytes_per_second" integer,
	"backpressure_enabled" boolean DEFAULT true NOT NULL,
	"backpressure_strategy" text DEFAULT 'drop' NOT NULL,
	"sample_rate" integer DEFAULT 100 NOT NULL,
	"trace_sample_rate" integer DEFAULT 100 NOT NULL,
	"metric_sample_rate" integer DEFAULT 100 NOT NULL,
	"log_sample_rate" integer DEFAULT 100 NOT NULL,
	"service_sampling_config" jsonb,
	"alert_on_limit_exceeded" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "investigation_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"finding_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"service_name" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"evidence_snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "investigation_cases_status_check" CHECK ("investigation_cases"."status" in ('open', 'investigating', 'resolved', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "issue_lifecycles" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"issue_key" text NOT NULL,
	"identity" jsonb NOT NULL,
	"status" text NOT NULL,
	"first_observed_at" timestamp NOT NULL,
	"last_observed_at" timestamp NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "issue_lifecycles_status_check" CHECK ("issue_lifecycles"."status" in ('active', 'resolved'))
);
--> statement-breakpoint
CREATE TABLE "maintenance_windows" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"affected_services" text[] DEFAULT '{}',
	"affected_alert_rules" text[] DEFAULT '{}',
	"recurring_schedule" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"channel_id" text,
	"channel_type" text NOT NULL,
	"incident_id" text,
	"alert_rule_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_message_id" text,
	"error" text,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "project_settings" (
	"project_id" text PRIMARY KEY NOT NULL,
	"redact_sensitive_data" boolean DEFAULT true NOT NULL,
	"capture_request_headers" boolean DEFAULT false NOT NULL,
	"capture_request_body" boolean DEFAULT false NOT NULL,
	"capture_response_body" boolean DEFAULT false NOT NULL,
	"max_attribute_count" integer DEFAULT 100 NOT NULL,
	"max_attribute_value_length" integer DEFAULT 4096 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rca_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"finding_id" text NOT NULL,
	"service_name" text NOT NULL,
	"severity" text NOT NULL,
	"summary" text NOT NULL,
	"root_cause" text NOT NULL,
	"contributing_factors" jsonb NOT NULL,
	"investigation_steps" jsonb NOT NULL,
	"suggested_changes" jsonb NOT NULL,
	"evidence_refs" jsonb NOT NULL,
	"limitations" jsonb NOT NULL,
	"confidence" text NOT NULL,
	"evidence_snapshot" jsonb NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"credential_source" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rca_invocations" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"finding_id" text NOT NULL,
	"status" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"request_duration_ms" integer NOT NULL,
	"retries" integer NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"estimated_cost_usd" real,
	"credential_source" text,
	"credential_id" text,
	"error_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retention_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"data_type" text NOT NULL,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"max_storage_gb" integer,
	"auto_cleanup" boolean DEFAULT true NOT NULL,
	"cleanup_schedule" text DEFAULT 'daily' NOT NULL,
	"last_cleanup_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"language" text,
	"framework" text,
	"repository_url" text,
	"repository_provider" text,
	"repository_branch" text,
	"owner_id" text,
	"team_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "slo_compliance_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"slo_id" integer NOT NULL,
	"timestamp" timestamp NOT NULL,
	"compliance" integer NOT NULL,
	"error_budget_remaining" integer NOT NULL,
	"good_events" integer NOT NULL,
	"total_events" integer NOT NULL,
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slos" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"service_name" text NOT NULL,
	"target_percentage" integer NOT NULL,
	"period" text NOT NULL,
	"measurement_type" text NOT NULL,
	"good_events_threshold" integer,
	"window_size" integer DEFAULT 30 NOT NULL,
	"current_compliance" integer,
	"error_budget_remaining" integer,
	"error_budget_burn_rate" text,
	"last_calculated_at" timestamp,
	"alert_on_burn_rate" boolean DEFAULT true NOT NULL,
	"alert_thresholds" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "status_page_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"email" text NOT NULL,
	"slack_webhook_url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"subscribed_at" timestamp DEFAULT now(),
	"unsubscribed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "synthetic_probe_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"probe_id" integer NOT NULL,
	"status" text NOT NULL,
	"status_code" integer,
	"response_time_ms" integer,
	"error_message" text,
	"checked_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "synthetic_probes" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"method" text DEFAULT 'GET' NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb,
	"body" text,
	"expected_status_code" integer DEFAULT 200 NOT NULL,
	"timeout_ms" integer DEFAULT 30000 NOT NULL,
	"interval_seconds" integer DEFAULT 60 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"region" text DEFAULT 'us-east-1',
	"last_check_at" timestamp,
	"last_status" text DEFAULT 'unknown',
	"uptime_percent" integer DEFAULT 100,
	"total_checks" integer DEFAULT 0,
	"failed_checks" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text,
	"types" text[] DEFAULT '{}',
	"is_active" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_audit_events" ADD CONSTRAINT "agent_audit_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_events" ADD CONSTRAINT "agent_audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_events" ADD CONSTRAINT "agent_audit_events_investigation_id_investigation_cases_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigation_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_policies" ADD CONSTRAINT "agent_policies_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_policies" ADD CONSTRAINT "agent_policies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_credentials" ADD CONSTRAINT "ai_provider_credentials_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_plan_quotas" ADD CONSTRAINT "billing_plan_quotas_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_plan_quotas" ADD CONSTRAINT "billing_plan_quotas_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_periods" ADD CONSTRAINT "usage_periods_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_periods" ADD CONSTRAINT "usage_periods_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_operations" ADD CONSTRAINT "business_operations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_operations" ADD CONSTRAINT "business_operations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_operations" ADD CONSTRAINT "business_operations_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_operations" ADD CONSTRAINT "business_operations_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canary_deployments" ADD CONSTRAINT "canary_deployments_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detection_runs" ADD CONSTRAINT "detection_runs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detection_runs" ADD CONSTRAINT "detection_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_ownership" ADD CONSTRAINT "incident_ownership_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_ownership" ADD CONSTRAINT "incident_ownership_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_ownership" ADD CONSTRAINT "incident_ownership_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_timeline_events" ADD CONSTRAINT "incident_timeline_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_timeline_events" ADD CONSTRAINT "incident_timeline_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investigation_cases" ADD CONSTRAINT "investigation_cases_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investigation_cases" ADD CONSTRAINT "investigation_cases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investigation_cases" ADD CONSTRAINT "investigation_cases_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_lifecycles" ADD CONSTRAINT "issue_lifecycles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_lifecycles" ADD CONSTRAINT "issue_lifecycles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_channel_id_notification_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_settings" ADD CONSTRAINT "project_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rca_analyses" ADD CONSTRAINT "rca_analyses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rca_analyses" ADD CONSTRAINT "rca_analyses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rca_analyses" ADD CONSTRAINT "rca_analyses_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rca_invocations" ADD CONSTRAINT "rca_invocations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rca_invocations" ADD CONSTRAINT "rca_invocations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rca_invocations" ADD CONSTRAINT "rca_invocations_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slo_compliance_snapshots" ADD CONSTRAINT "slo_compliance_snapshots_slo_id_slos_id_fk" FOREIGN KEY ("slo_id") REFERENCES "public"."slos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthetic_probe_results" ADD CONSTRAINT "synthetic_probe_results_probe_id_synthetic_probes_id_fk" FOREIGN KEY ("probe_id") REFERENCES "public"."synthetic_probes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_policies_org_default_idx" ON "agent_policies" USING btree ("org_id") WHERE "agent_policies"."user_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_policies_org_user_unique_idx" ON "agent_policies" USING btree ("org_id","user_id") WHERE "agent_policies"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_provider_credentials_org_unique" ON "ai_provider_credentials" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "alert_rules_org_project_idx" ON "alert_rules" USING btree ("org_id","project_id");--> statement-breakpoint
CREATE INDEX "alert_rules_project_status_idx" ON "alert_rules" USING btree ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_issuer_account_id_idx" ON "accounts" USING btree ("issuer","provider_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_events_org_external_event_idx" ON "billing_events" USING btree ("org_id","external_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_plan_quotas_plan_metric_idx" ON "billing_plan_quotas" USING btree ("plan_id","metric");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_plan_quotas_org_metric_unique_idx" ON "billing_plan_quotas" USING btree ("org_id","metric") WHERE "billing_plan_quotas"."org_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_org_idx" ON "subscriptions" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_events_org_idempotency_unique_idx" ON "usage_events" USING btree ("org_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_periods_scope_metric_period_idx" ON "usage_periods" USING btree ("org_id","project_id","metric","period_start","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "incident_ownership_incident_idx" ON "incident_ownership" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "incident_ownership_owner_idx" ON "incident_ownership" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "incident_timeline_events_incident_idx" ON "incident_timeline_events" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "incident_timeline_events_created_idx" ON "incident_timeline_events" USING btree ("incident_id","created_at");--> statement-breakpoint
CREATE INDEX "ingest_event_receipts_created_at_idx" ON "ingest_event_receipts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ingest_event_receipts_status_idx" ON "ingest_event_receipts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "investigation_cases_project_created_idx" ON "investigation_cases" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "investigation_cases_finding_status_idx" ON "investigation_cases" USING btree ("finding_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "investigation_cases_open_finding_unique" ON "investigation_cases" USING btree ("finding_id") WHERE "investigation_cases"."status" = 'open';--> statement-breakpoint
CREATE UNIQUE INDEX "issue_lifecycles_project_issue_key_idx" ON "issue_lifecycles" USING btree ("project_id","issue_key");--> statement-breakpoint
CREATE INDEX "issue_lifecycles_org_status_idx" ON "issue_lifecycles" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "issue_lifecycles_project_status_idx" ON "issue_lifecycles" USING btree ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_channels_project_name_idx" ON "notification_channels" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "notification_channels_org_type_idx" ON "notification_channels" USING btree ("org_id","type");--> statement-breakpoint
CREATE INDEX "notification_channels_project_active_idx" ON "notification_channels" USING btree ("project_id","is_active");--> statement-breakpoint
CREATE INDEX "notification_logs_org_created_idx" ON "notification_logs" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_logs_project_status_idx" ON "notification_logs" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "notification_logs_incident_idx" ON "notification_logs" USING btree ("incident_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_organization_id_name_idx" ON "projects" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_organization_id_slug_idx" ON "projects" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_org_project_idx" ON "webhook_endpoints" USING btree ("org_id","project_id");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_project_active_idx" ON "webhook_endpoints" USING btree ("project_id","is_active");