import { generateId } from '../generate-id';
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  email: text('email').unique().notNull(),
  name: text('name'),
  image: text('image'),
  emailVerified: boolean('email_verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  providerId: text('provider_id').notNull(),
  providerUserId: text('provider_user_id'),
  passwordHash: text('password_hash'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const members = pgTable('members', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
