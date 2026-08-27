import { generateId } from '../generate-id';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const projects = pgTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
