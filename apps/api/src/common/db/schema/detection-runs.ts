import { generateId } from '../generate-id';
import { pgTable, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { projects } from './projects';

export const detectionRuns = pgTable('detection_runs', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  windowStart: timestamp('window_start').notNull(),
  windowEnd: timestamp('window_end').notNull(),
  status: text('status').notNull(),
  findingsCount: integer('findings_count').notNull().default(0),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  error: text('error'),
});
