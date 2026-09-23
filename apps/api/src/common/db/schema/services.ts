import { generateId } from '../generate-id';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { projects } from './projects';
import { teams } from './teams';
import { users } from './auth';

export const services = pgTable('services', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  language: text('language'),
  framework: text('framework'),
  repositoryUrl: text('repository_url'),
  repositoryProvider: text('repository_provider'),
  repositoryBranch: text('repository_branch'),
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }),
  teamId: text('team_id').references(() => teams.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});