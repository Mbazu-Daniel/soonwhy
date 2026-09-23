import { generateId } from '../generate-id';
import { integer, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { projects } from './projects';
import { findings } from './findings';

export const rcaInvocations = pgTable('rca_invocations', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  findingId: text('finding_id').references(() => findings.id, { onDelete: 'cascade' }).notNull(),
  status: text('status').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  requestDurationMs: integer('request_duration_ms').notNull(),
  retries: integer('retries').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  totalTokens: integer('total_tokens'),
  estimatedCostUsd: real('estimated_cost_usd'),
  errorCode: text('error_code'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
