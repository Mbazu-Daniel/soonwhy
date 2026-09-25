import { generateId } from '../generate-id';
import { jsonb, pgTable, text, timestamp, real } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { projects } from './projects';
import { services } from './services';

export interface DetectionEvidence {
  kind: 'metric' | 'request' | 'log' | 'trace' | 'recommendation';
  label: string;
  value: number | string;
  context?: Record<string, string | number | boolean | null>;
}

export const findings = pgTable('findings', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  serviceId: text('service_id').references(() => services.id, { onDelete: 'set null' }),
  serviceName: text('service_name').notNull(),
  type: text('type').notNull(),
  severity: text('severity').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  observedValue: real('observed_value').notNull(),
  threshold: real('threshold').notNull(),
  unit: text('unit').notNull(),
  windowStart: timestamp('window_start').notNull(),
  windowEnd: timestamp('window_end').notNull(),
  detectedAt: timestamp('detected_at').defaultNow().notNull(),
  evidence: jsonb('evidence').$type<DetectionEvidence[]>().notNull(),
});
