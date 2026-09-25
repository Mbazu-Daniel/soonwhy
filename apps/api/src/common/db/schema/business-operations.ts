import { generateId } from '../generate-id';
import { pgTable, text, timestamp, integer, real } from 'drizzle-orm/pg-core';
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
});
