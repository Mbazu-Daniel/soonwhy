export const SCRATCH_DATABASE_TIMEOUT_MS = 180_000;

const EMPTY_ARRAY_DEFAULT_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ["maintenance_windows", "affected_services"],
  ["maintenance_windows", "affected_alert_rules"],
  ["api_keys", "scopes"],
  ["notification_channels", "recipient_emails"],
  ["notification_channels", "webhook_types"],
  ["webhook_endpoints", "types"],
  ["alert_rules", "channel_ids"],
];

const EXPRESSION_INDEX = "ai_provider_credentials_org_name_unique";

export const KNOWN_INTROSPECTION_NOISE: ReadonlySet<string> = new Set([
  ...EMPTY_ARRAY_DEFAULT_COLUMNS.map(([table, column]) => `ALTER TABLE "${table}" ALTER COLUMN "${column}" SET DEFAULT '{}';`),
  `DROP INDEX "${EXPRESSION_INDEX}";`,
  `CREATE UNIQUE INDEX "${EXPRESSION_INDEX}" ON "ai_provider_credentials" USING btree ("org_id",lower("name")) WHERE "ai_provider_credentials"."deleted_at" is null;`,
]);
