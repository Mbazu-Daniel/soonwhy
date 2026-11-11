import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const ingestLimits = pgTable('ingest_limits', {
  id: serial('id').primaryKey(),
  orgId: text('org_id').notNull(),
  projectId: text('project_id').notNull(),
  maxEventsPerSecond: integer('max_events_per_second').notNull().default(1000),
  maxBytesPerSecond: integer('max_bytes_per_second'), // Optional
  backpressureEnabled: boolean('backpressure_enabled').notNull().default(true),
  backpressureStrategy: text('backpressure_strategy').notNull().default('drop'), // 'drop', 'sample', 'queue'
  sampleRate: integer('sample_rate').notNull().default(100), // 0-100% overall
  // Per-signal-type sampling
  traceSampleRate: integer('trace_sample_rate').notNull().default(100), // 0-100%
  metricSampleRate: integer('metric_sample_rate').notNull().default(100), // 0-100%
  logSampleRate: integer('log_sample_rate').notNull().default(100), // 0-100%
  // Service-specific sampling overrides
  serviceSamplingConfig: jsonb('service_sampling_config'), // { "service-name": { traces: 50, metrics: 100, logs: 10 } }
  alertOnLimitExceeded: boolean('alert_on_limit_exceeded').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
