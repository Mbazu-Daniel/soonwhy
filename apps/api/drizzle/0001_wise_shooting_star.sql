CREATE TABLE "ai_investigations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"investigation_id" text NOT NULL,
	"project_id" text NOT NULL,
	"status" text NOT NULL,
	"progress" text NOT NULL,
	"current_step" text,
	"result" jsonb,
	"error" text,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_investigations_investigation_id_unique" UNIQUE("investigation_id")
);
--> statement-breakpoint
CREATE TABLE "alert_triggers" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"alert_rule_id" text NOT NULL,
	"alert_name" text NOT NULL,
	"triggered_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"state" text DEFAULT 'healthy' NOT NULL,
	"state_transition_reason" text,
	"last_state_transition_at" timestamp DEFAULT now() NOT NULL,
	"severity" text NOT NULL,
	"streak_count" integer DEFAULT 1 NOT NULL,
	"last_streak_reset_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_suppression_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"conditions" jsonb NOT NULL,
	"target_alert_rule_ids" jsonb,
	"target_services" jsonb,
	"schedule_type" text DEFAULT 'always' NOT NULL,
	"schedule_config" jsonb,
	"conditional_config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capacity_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"service_name" text NOT NULL,
	"cpu_percent" integer,
	"memory_percent" integer,
	"memory_used_mb" integer,
	"memory_total_mb" integer,
	"event_loop_lag_ms" integer,
	"active_requests" integer,
	"max_concurrency" integer,
	"cpu_exhausted" boolean DEFAULT false NOT NULL,
	"memory_exhausted" boolean DEFAULT false NOT NULL,
	"event_loop_stalled" boolean DEFAULT false NOT NULL,
	"concurrency_exceeded" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"edge_id" text NOT NULL,
	"source_node_id" text NOT NULL,
	"target_node_id" text NOT NULL,
	"edge_type" text NOT NULL,
	"strength" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	CONSTRAINT "evidence_edges_edge_id_unique" UNIQUE("edge_id")
);
--> statement-breakpoint
CREATE TABLE "evidence_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"node_id" text NOT NULL,
	"node_type" text NOT NULL,
	"identity" jsonb NOT NULL,
	"data" jsonb NOT NULL,
	"timestamp" timestamp NOT NULL,
	"trace_id" text,
	"service_name" text,
	"deployment_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	CONSTRAINT "evidence_nodes_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE "saved_queries" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"data_type" text NOT NULL,
	"query" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"data_type" text NOT NULL,
	"field_name" text NOT NULL,
	"field_type" text NOT NULL,
	"values" jsonb[],
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_page_analytics" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"page_id" text NOT NULL,
	"visitor_hash" text NOT NULL,
	"visit_date" text NOT NULL,
	"visited_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "status_page_subscriptions" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD COLUMN "attempts" text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD COLUMN "last_attempt_at" timestamp;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD COLUMN "next_attempt_at" timestamp;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD COLUMN "leased_until" timestamp;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD COLUMN "permanent_failure" text;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_investigations" ADD CONSTRAINT "ai_investigations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_triggers" ADD CONSTRAINT "alert_triggers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_triggers" ADD CONSTRAINT "alert_triggers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_triggers" ADD CONSTRAINT "alert_triggers_alert_rule_id_alert_rules_id_fk" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_suppression_rules" ADD CONSTRAINT "alert_suppression_rules_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_suppression_rules" ADD CONSTRAINT "alert_suppression_rules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_metrics" ADD CONSTRAINT "capacity_metrics_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_metrics" ADD CONSTRAINT "capacity_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_edges" ADD CONSTRAINT "evidence_edges_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_nodes" ADD CONSTRAINT "evidence_nodes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_analytics" ADD CONSTRAINT "status_page_analytics_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_analytics" ADD CONSTRAINT "status_page_analytics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_investigations_org_idx" ON "ai_investigations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_investigations_project_idx" ON "ai_investigations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "ai_investigations_status_idx" ON "ai_investigations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_investigations_investigation_idx" ON "ai_investigations" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "alert_triggers_org_project_idx" ON "alert_triggers" USING btree ("org_id","project_id");--> statement-breakpoint
CREATE INDEX "alert_triggers_alert_rule_idx" ON "alert_triggers" USING btree ("alert_rule_id");--> statement-breakpoint
CREATE INDEX "alert_triggers_triggered_at_idx" ON "alert_triggers" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "alert_triggers_status_idx" ON "alert_triggers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "alert_triggers_state_idx" ON "alert_triggers" USING btree ("state");--> statement-breakpoint
CREATE INDEX "evidence_edges_org_idx" ON "evidence_edges" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "evidence_edges_edge_idx" ON "evidence_edges" USING btree ("edge_id");--> statement-breakpoint
CREATE INDEX "evidence_edges_source_idx" ON "evidence_edges" USING btree ("source_node_id");--> statement-breakpoint
CREATE INDEX "evidence_edges_target_idx" ON "evidence_edges" USING btree ("target_node_id");--> statement-breakpoint
CREATE INDEX "evidence_edges_expires_idx" ON "evidence_edges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "evidence_nodes_org_idx" ON "evidence_nodes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "evidence_nodes_node_idx" ON "evidence_nodes" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "evidence_nodes_trace_idx" ON "evidence_nodes" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "evidence_nodes_service_idx" ON "evidence_nodes" USING btree ("service_name");--> statement-breakpoint
CREATE INDEX "evidence_nodes_deployment_idx" ON "evidence_nodes" USING btree ("deployment_id");--> statement-breakpoint
CREATE INDEX "evidence_nodes_expires_idx" ON "evidence_nodes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "saved_queries_org_project_idx" ON "saved_queries" USING btree ("org_id","project_id");--> statement-breakpoint
CREATE INDEX "saved_queries_data_type_idx" ON "saved_queries" USING btree ("data_type");--> statement-breakpoint
CREATE INDEX "schema_catalog_org_project_idx" ON "schema_catalog" USING btree ("org_id","project_id");--> statement-breakpoint
CREATE INDEX "schema_catalog_data_type_idx" ON "schema_catalog" USING btree ("data_type");--> statement-breakpoint
CREATE INDEX "schema_catalog_field_name_idx" ON "schema_catalog" USING btree ("field_name");--> statement-breakpoint
CREATE INDEX "status_page_analytics_page_date_idx" ON "status_page_analytics" USING btree ("page_id","visit_date");--> statement-breakpoint
CREATE INDEX "status_page_analytics_visitor_hash_idx" ON "status_page_analytics" USING btree ("visitor_hash");--> statement-breakpoint
ALTER TABLE "status_page_subscriptions" ADD CONSTRAINT "status_page_subscriptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_subscriptions" ADD CONSTRAINT "status_page_subscriptions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_logs_next_attempt_idx" ON "notification_logs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notification_logs_idempotency_idx" ON "notification_logs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "status_page_subscriptions_org_project_idx" ON "status_page_subscriptions" USING btree ("org_id","project_id");--> statement-breakpoint
CREATE INDEX "status_page_subscriptions_email_idx" ON "status_page_subscriptions" USING btree ("email");--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_idempotency_key_unique" UNIQUE("idempotency_key");