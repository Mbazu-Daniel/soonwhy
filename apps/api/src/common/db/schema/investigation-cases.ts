import { generateId } from '../generate-id';
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
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
}, (table) => ({
  projectCreatedIdx: index('investigation_cases_project_created_idx').on(table.projectId, table.createdAt),
  findingStatusIdx: index('investigation_cases_finding_status_idx').on(table.findingId, table.status),
  openFindingUnique: uniqueIndex('investigation_cases_open_finding_unique')
    .on(table.findingId)
    .where(sql`${table.status} = 'open'`),
  statusCheck: check(
    'investigation_cases_status_check',
    sql`${table.status} in ('open', 'investigating', 'resolved', 'closed')`,
  ),
}));
