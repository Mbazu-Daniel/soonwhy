import { pgTable, serial, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';
import { deployments } from './deployments';
import { sql } from 'drizzle-orm';

export const canaryDeployments = pgTable('canary_deployments', {
  id: serial('id').primaryKey(),
  orgId: text('org_id').notNull(),
  projectId: text('project_id').notNull(),
  deploymentId: text('deployment_id').references(() => deployments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status').notNull().default('pending'), // pending, running, passed, failed
  targetUrl: text('target_url').notNull(),
  baselineUrl: text('baseline_url'),
  validationRules: jsonb('validation_rules').$type<{
    maxResponseTimeMs?: number;
    minSuccessRate?: number;
    errorThreshold?: number;
  }>().default(sql`'{}'::jsonb`),
  probeResults: jsonb('probe_results').$type<Array<{
    probeId: number;
    status: string;
    responseTimeMs: number;
    timestamp: string;
  }>>().default(sql`'[]'::jsonb`),
  metrics: jsonb('metrics').$type<{
    avgResponseTime: number;
    successRate: number;
    errorCount: number;
    totalChecks: number;
  }>().default(sql`'{}'::jsonb`),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
