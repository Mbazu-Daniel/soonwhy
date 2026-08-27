import { generateId } from '../generate-id';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  prefix: text('prefix').notNull(),
  keyHash: text('key_hash').notNull(),
  scopes: text('scopes').array().default([]),
  expiresAt: timestamp('expires_at'),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
