import { pgTable, serial, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core';

export const retentionPolicies = pgTable('retention_policies', {
  id: serial('id').primaryKey(),
  orgId: text('org_id').notNull(),
  projectId: text('project_id').notNull(),
  dataType: text('data_type').notNull(), // 'traces', 'logs', 'metrics', 'errors'
  retentionDays: integer('retention_days').notNull().default(30),
  maxStorageGb: integer('max_storage_gb'), // Optional storage limit
  autoCleanup: boolean('auto_cleanup').notNull().default(true),
  cleanupSchedule: text('cleanup_schedule').notNull().default('daily'), // 'daily', 'weekly', 'monthly'
  lastCleanupAt: timestamp('last_cleanup_at'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
