import { generateId } from '../generate-id';
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { projects } from './projects';
import { findings } from './findings';

export type InvestigationEvidenceRef = {
  findingId: string;
  kind: string;
  label: string;
  value: number | string;
};

export const investigationCases = pgTable('investigation_cases', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  findingId: text('finding_id').references(() => findings.id, { onDelete: 'cascade' }).notNull(),
  status: text('status').notNull().default('open'),
  serviceName: text('service_name').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  evidence: jsonb('evidence').$type<InvestigationEvidenceRef[]>().notNull(),
  evidenceSnapshot: jsonb('evidence_snapshot').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
