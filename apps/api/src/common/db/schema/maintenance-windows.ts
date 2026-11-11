import { pgTable, serial, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const maintenanceWindows = pgTable('maintenance_windows', {
  id: serial('id').primaryKey(),
  orgId: text('org_id').notNull(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  affectedServices: text('affected_services').array().default([]), // Service names to suppress alerts for
  affectedAlertRules: text('affected_alert_rules').array().default([]), // Alert rule IDs to suppress
  recurringSchedule: jsonb('recurring_schedule'), // Optional recurring schedule (daily, weekly, etc.)
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
