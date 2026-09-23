import { generateId } from '../generate-id';
import { pgTable, text, timestamp, real, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';
import { projects } from './projects';
import { services } from './services';
import { environments } from './environments';

export const businessOperations = pgTable('business_operations', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  serviceId: text('service_id').references(() => services.id, { onDelete: 'cascade' }).notNull(),
  environmentId: text('environment_id').references(() => environments.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  method: text('method'),
  routePattern: text('route_pattern'),
  criticality: text('criticality').notNull().default('medium'),
  sloMetric: text('slo_metric'),
  sloTarget: real('slo_target'),
  sloUnit: text('slo_unit'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  projectSlugUnique: uniqueIndex('business_operations_project_slug_unique')
    .on(table.projectId, table.slug),
  criticalityCheck: check(
    'business_operations_criticality_check',
    sql`${table.criticality} in ('low', 'medium', 'high', 'critical')`,
  ),
  sloTargetCheck: check(
    'business_operations_slo_target_check',
    sql`${table.sloTarget} is null or ${table.sloTarget} > 0`,
  ),
}));
