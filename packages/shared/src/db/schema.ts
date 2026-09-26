import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** Lookup tables used by ingest edge auth (not the full API schema). */
export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  prefix: text('prefix').notNull(),
  keyHash: text('key_hash').notNull(),
  scopes: text('scopes').array().default([]),
  expiresAt: timestamp('expires_at'),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const projectSettings = pgTable('project_settings', {
  projectId: text('project_id').primaryKey().references(() => projects.id, { onDelete: 'cascade' }),
  redactSensitiveData: boolean('redact_sensitive_data').default(true).notNull(),
  captureRequestHeaders: boolean('capture_request_headers').default(false).notNull(),
  captureRequestBody: boolean('capture_request_body').default(false).notNull(),
  captureResponseBody: boolean('capture_response_body').default(false).notNull(),
  maxAttributeCount: integer('max_attribute_count').default(100).notNull(),
  maxAttributeValueLength: integer('max_attribute_value_length').default(4096).notNull(),
});
