import { pgTable, serial, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';

export const slos = pgTable('slos', {
  id: serial('id').primaryKey(),
  orgId: text('org_id').notNull(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  serviceName: text('service_name').notNull(),
  // SLO definition
  targetPercentage: integer('target_percentage').notNull(), // e.g., 99.9 for 99.9%
  period: text('period').notNull(), // '7d', '30d', '90d', 'rolling'
  // Error budget calculation
  measurementType: text('measurement_type').notNull(), // 'availability', 'latency', 'error_rate'
  goodEventsThreshold: integer('good_events_threshold'), // For latency: response time threshold in ms
  windowSize: integer('window_size').notNull().default(30), // Number of days in rolling window
  // Current state
  currentCompliance: integer('current_compliance'), // Current percentage
  errorBudgetRemaining: integer('error_budget_remaining'), // Percentage remaining
  errorBudgetBurnRate: text('error_budget_burn_rate'), // 'slow', 'fast', 'critical'
  lastCalculatedAt: timestamp('last_calculated_at'),
  // Alerting
  alertOnBurnRate: boolean('alert_on_burn_rate').notNull().default(true),
  alertThresholds: jsonb('alert_thresholds'), // { warning: 20, critical: 10 } - percentage remaining
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const sloComplianceSnapshots = pgTable('slo_compliance_snapshots', {
  id: serial('id').primaryKey(),
  sloId: integer('slo_id').notNull().references(() => slos.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp').notNull(),
  compliance: integer('compliance').notNull(), // Percentage
  errorBudgetRemaining: integer('error_budget_remaining').notNull(), // Percentage
  goodEvents: integer('good_events').notNull(),
  totalEvents: integer('total_events').notNull(),
  windowStart: timestamp('window_start').notNull(),
  windowEnd: timestamp('window_end').notNull(),
});
