import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
