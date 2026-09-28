import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { generateId } from '../generate-id';
import { organizations } from './organizations';
import { projects } from './projects';

export const issueLifecycles = pgTable('issue_lifecycles', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  issueKey: text('issue_key').notNull(),
  identity: jsonb('identity').notNull(),
  status: text('status').notNull(),
  firstObservedAt: timestamp('first_observed_at').notNull(),
  lastObservedAt: timestamp('last_observed_at').notNull(),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('issue_lifecycles_project_issue_key_idx').on(table.projectId, table.issueKey),
  index('issue_lifecycles_org_status_idx').on(table.orgId, table.status),
  index('issue_lifecycles_project_status_idx').on(table.projectId, table.status),
  check('issue_lifecycles_status_check', sql`${table.status} in ('active', 'resolved')`),
]);
