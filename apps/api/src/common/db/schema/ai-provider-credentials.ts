import { generateId } from '../generate-id';
import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const aiProviderCredentials = pgTable('ai_provider_credentials', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  baseUrl: text('base_url'),
  encryptedApiKey: text('encrypted_api_key').notNull(),
  keyHint: text('key_hint').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({ orgUnique: uniqueIndex('ai_provider_credentials_org_unique').on(table.orgId) }));
