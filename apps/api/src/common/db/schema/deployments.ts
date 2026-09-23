import { generateId } from '../generate-id';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { environments } from './environments';
import { services } from './services';

export const deployments = pgTable('deployments', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  serviceId: text('service_id').references(() => services.id, { onDelete: 'cascade' }).notNull(),
  environmentId: text('environment_id').references(() => environments.id, { onDelete: 'cascade' }).notNull(),
  version: text('version'),
  commitSha: text('commit_sha'),
  status: text('status').notNull().default('active'),
  deployedAt: timestamp('deployed_at').defaultNow(),
});
