import { jsonb, integer, pgTable, real, text, timestamp, boolean, check, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { generateId } from '../generate-id';
import { organizations } from './organizations';
import { users } from './auth';
import { investigationCases } from './investigation-cases';

export type AgentAccessPolicy = {
  id?: string;
  orgId: string;
  userId?: string | null;
  allowedTools: string[];
  maxRequestsPerMinute: number;
  maxTokensPerInvestigation: number;
  maxCostUsdPerInvestigation: number;
  redactSensitiveData: boolean;
};

export const agentPolicies = pgTable('agent_policies', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  allowedTools: jsonb('allowed_tools').$type<string[]>().notNull(),
  maxRequestsPerMinute: integer('max_requests_per_minute').default(30).notNull(),
  maxTokensPerInvestigation: integer('max_tokens_per_investigation').default(20000).notNull(),
  maxCostUsdPerInvestigation: real('max_cost_usd_per_investigation').default(1).notNull(),
  redactSensitiveData: boolean('redact_sensitive_data').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('agent_policies_org_default_idx').on(table.orgId).where(sql`${table.userId} IS NULL`),
  uniqueIndex('agent_policies_org_user_unique_idx').on(table.orgId, table.userId).where(sql`${table.userId} IS NOT NULL`),
  check('agent_policies_requests_positive', sql`${table.maxRequestsPerMinute} > 0`),
  check('agent_policies_tokens_positive', sql`${table.maxTokensPerInvestigation} > 0`),
  check('agent_policies_cost_non_negative', sql`${table.maxCostUsdPerInvestigation} >= 0`),
]);

export const agentAuditEvents = pgTable('agent_audit_events', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  investigationId: text('investigation_id').references(() => investigationCases.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(),
  toolName: text('tool_name'),
  model: text('model'),
  status: text('status').notNull(),
  tokens: integer('tokens'),
  costUsd: real('cost_usd'),
  metadata: jsonb('metadata').$type<Record<string, string | number | boolean | null>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  check('agent_audit_events_tokens_non_negative', sql`${table.tokens} IS NULL OR ${table.tokens} >= 0`),
  check('agent_audit_events_cost_non_negative', sql`${table.costUsd} IS NULL OR ${table.costUsd} >= 0`),
  check('agent_audit_events_event_type', sql`${table.eventType} IN ('tool_authorized', 'tool_denied', 'tool_completed', 'tool_failed')`),
  check('agent_audit_events_status', sql`${table.status} IN ('allowed', 'denied', 'completed', 'failed')`),
]);
