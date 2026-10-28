import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const syntheticProbes = pgTable('synthetic_probes', {
  id: serial('id').primaryKey(),
  orgId: text('org_id').notNull(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  method: text('method').notNull().default('GET'),
  headers: jsonb('headers').$type<Record<string, string>>().default(sql`'{}'::jsonb`),
  body: text('body'),
  expectedStatusCode: integer('expected_status_code').notNull().default(200),
  timeoutMs: integer('timeout_ms').notNull().default(30000),
  intervalSeconds: integer('interval_seconds').notNull().default(60),
  enabled: boolean('enabled').notNull().default(true),
  region: text('region').default('us-east-1'),
  lastCheckAt: timestamp('last_check_at'),
  lastStatus: text('last_status').default('unknown'), // up, down, degraded
  uptimePercent: integer('uptime_percent').default(100),
  totalChecks: integer('total_checks').default(0),
  failedChecks: integer('failed_checks').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const syntheticProbeResults = pgTable('synthetic_probe_results', {
  id: serial('id').primaryKey(),
  probeId: integer('probe_id').notNull().references(() => syntheticProbes.id, { onDelete: 'cascade' }),
  status: text('status').notNull(), // up, down, degraded
  statusCode: integer('status_code'),
  responseTimeMs: integer('response_time_ms'),
  errorMessage: text('error_message'),
  checkedAt: timestamp('checked_at').defaultNow(),
});
