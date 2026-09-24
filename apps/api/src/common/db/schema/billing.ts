import { generateId } from '../generate-id';
import { sql } from 'drizzle-orm';
import { bigint, boolean, check, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { projects } from './projects';

export type UsageMetric =
  | 'telemetry_bytes'
  | 'trace_spans'
  | 'retained_data_bytes'
  | 'rca_invocations'
  | 'ai_tokens'
  | 'investigations'
  | 'sdk_events';

export type BillingEventType =
  | 'usage_recorded'
  | 'quota_exceeded'
  | 'subscription_started'
  | 'subscription_changed'
  | 'subscription_cancelled'
  | 'trial_started'
  | 'trial_ended';

export const billingPlans = pgTable('billing_plans', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  name: text('name').unique().notNull(),
  displayName: text('display_name').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const billingPlanQuotas = pgTable('billing_plan_quotas', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  planId: text('plan_id').references(() => billingPlans.id, { onDelete: 'cascade' }).notNull(),
  metric: text('metric').$type<UsageMetric>().notNull(),
  limit: bigint('limit', { mode: 'number' }),
  unit: text('unit').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('billing_plan_quotas_plan_metric_idx').on(table.planId, table.metric),
  check('billing_plan_quotas_limit_non_negative', sql`${table.limit} IS NULL OR ${table.limit} >= 0`),
]);

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  planId: text('plan_id').references(() => billingPlans.id).notNull(),
  status: text('status').notNull(),
  trialEndsAt: timestamp('trial_ends_at'),
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  externalCustomerId: text('external_customer_id'),
  externalSubscriptionId: text('external_subscription_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('subscriptions_org_idx').on(table.orgId),
  check('subscriptions_period_valid', sql`${table.currentPeriodStart} < ${table.currentPeriodEnd}`),
]);

export const usageEvents = pgTable('usage_events', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  metric: text('metric').$type<UsageMetric>().notNull(),
  quantity: bigint('quantity', { mode: 'number' }).notNull(),
  source: text('source').notNull(),
  idempotencyKey: text('idempotency_key'),
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
  metadata: jsonb('metadata').$type<Record<string, string | number | boolean | null>>(),
}, (table) => [
  uniqueIndex('usage_events_org_idempotency_unique_idx').on(table.orgId, table.idempotencyKey),
  check('usage_events_quantity_positive', sql`${table.quantity} > 0`),
]);

export const usagePeriods = pgTable('usage_periods', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  metric: text('metric').$type<UsageMetric>().notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  quantity: bigint('quantity', { mode: 'number' }).default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('usage_periods_scope_metric_period_idx').on(table.orgId, table.projectId, table.metric, table.periodStart, table.periodEnd),
  check('usage_periods_quantity_non_negative', sql`${table.quantity} >= 0`),
  check('usage_periods_period_valid', sql`${table.periodStart} < ${table.periodEnd}`),
]);

export const billingEvents = pgTable('billing_events', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').$type<BillingEventType>().notNull(),
  metric: text('metric').$type<UsageMetric>(),
  quantity: bigint('quantity', { mode: 'number' }),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  externalEventId: text('external_event_id'),
  status: text('status').notNull(),
  metadata: jsonb('metadata').$type<Record<string, string | number | boolean | null>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('billing_events_org_external_event_idx').on(table.orgId, table.externalEventId),
  check('billing_events_quantity_non_negative', sql`${table.quantity} IS NULL OR ${table.quantity} >= 0`),
  check('billing_events_period_valid', sql`${table.periodStart} IS NULL OR ${table.periodEnd} IS NULL OR ${table.periodStart} < ${table.periodEnd}`),
]);
