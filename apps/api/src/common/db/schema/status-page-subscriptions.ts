import { generateId } from "../generate-id";
import { pgTable, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { organizations } from "./organizations";
import { projects } from "./projects";

export const statusPageSubscriptions = pgTable('status_page_subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  email: text('email').notNull(),
  slackWebhookUrl: text('slack_webhook_url'),
  enabled: boolean('enabled').notNull().default(true),
  subscribedAt: timestamp('subscribed_at').defaultNow(),
  unsubscribedAt: timestamp('unsubscribed_at'),
}, (table) => [
  index('status_page_subscriptions_org_project_idx').on(table.orgId, table.projectId),
  index('status_page_subscriptions_email_idx').on(table.email),
]);

// Privacy-preserving status page analytics (Outray pattern)
export const statusPageAnalytics = pgTable('status_page_analytics', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  pageId: text('page_id').notNull(), // status page identifier
  visitorHash: text('visitor_hash').notNull(), // HMAC-SHA256 of visitor data
  visitDate: text('visit_date').notNull(), // UTC date for rotation
  visitedAt: timestamp('visited_at').defaultNow().notNull(),
  // NOTE: Never store raw IP, UA, or referrer - only the hash
}, (table) => [
  index('status_page_analytics_page_date_idx').on(table.pageId, table.visitDate),
  index('status_page_analytics_visitor_hash_idx').on(table.visitorHash),
]);

// NOTE: Database migration required for status_page_analytics table
