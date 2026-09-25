import { generateId } from '../generate-id';
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { projects } from './projects';
import { findings } from './findings';

export const rcaAnalyses = pgTable('rca_analyses', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  findingId: text('finding_id').references(() => findings.id, { onDelete: 'cascade' }).notNull(),
  serviceName: text('service_name').notNull(),
  severity: text('severity').notNull(),
  summary: text('summary').notNull(),
  rootCause: text('root_cause').notNull(),
  contributingFactors: jsonb('contributing_factors').$type<string[]>().notNull(),
  investigationSteps: jsonb('investigation_steps').$type<string[]>().notNull(),
  suggestedChanges: jsonb('suggested_changes').$type<string[]>().notNull(),
  evidenceRefs: jsonb('evidence_refs').$type<string[]>().notNull(),
  limitations: jsonb('limitations').$type<string[]>().notNull(),
  confidence: text('confidence').notNull(),
  evidenceSnapshot: jsonb('evidence_snapshot').$type<Record<string, unknown>>().notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
