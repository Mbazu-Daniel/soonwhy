import { pgTable, serial, text, timestamp, integer, boolean, jsonb, index } from 'drizzle-orm/pg-core';

export const errorRegressions = pgTable('error_regressions', {
  id: serial('id').primaryKey(),
  orgId: text('org_id').notNull(),
  projectId: text('project_id').notNull(),
  fingerprint: text('fingerprint').notNull().unique(),
  errorMessage: text('error_message').notNull(),
  stackTrace: text('stack_trace'),
  serviceName: text('service_name'),
  firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
  occurrenceCount: integer('occurrence_count').notNull().default(1),
  lastResolvedAt: timestamp('last_resolved_at'),
  resolvedBy: text('resolved_by'),
  regressionCount: integer('regression_count').notNull().default(0),
  lastRegressionAt: timestamp('last_regression_at'),
  isRegression: boolean('is_regression').notNull().default(false),
  alertOnRegression: boolean('alert_on_regression').notNull().default(true),
  regressionNotified: boolean('regression_notified').notNull().default(false),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('error_regressions_org_project_fp_idx').on(table.orgId, table.projectId, table.fingerprint),
]);
