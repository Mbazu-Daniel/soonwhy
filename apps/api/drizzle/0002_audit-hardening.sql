ALTER TABLE "billing_events" DROP CONSTRAINT "billing_events_org_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_plan_quotas" DROP CONSTRAINT "billing_plan_quotas_org_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_org_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "usage_events" DROP CONSTRAINT "usage_events_org_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "usage_periods" DROP CONSTRAINT "usage_periods_org_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_plan_quotas" ADD CONSTRAINT "billing_plan_quotas_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_periods" ADD CONSTRAINT "usage_periods_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_events_org_metric_occurred_idx" ON "usage_events" USING btree ("org_id","metric","occurred_at");--> statement-breakpoint
CREATE INDEX "findings_service_id_idx" ON "findings" USING btree ("service_id") WHERE "findings"."service_id" is not null;--> statement-breakpoint
CREATE INDEX "incident_timeline_events_project_idx" ON "incident_timeline_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "rca_analyses_finding_id_idx" ON "rca_analyses" USING btree ("finding_id");--> statement-breakpoint
CREATE INDEX "rca_invocations_finding_id_idx" ON "rca_invocations" USING btree ("finding_id");