UPDATE "alert_triggers" SET "status" = 'resolved', "state" = 'healthy', "updated_at" = now()
WHERE "status" = 'active'
  AND "id" NOT IN (
    SELECT DISTINCT ON ("alert_rule_id") "id"
    FROM "alert_triggers"
    WHERE "status" = 'active'
    ORDER BY "alert_rule_id", "triggered_at" DESC, "id" DESC
  );--> statement-breakpoint
CREATE UNIQUE INDEX "alert_triggers_one_active_per_rule_uidx" ON "alert_triggers" USING btree ("alert_rule_id") WHERE "alert_triggers"."status" = 'active';
