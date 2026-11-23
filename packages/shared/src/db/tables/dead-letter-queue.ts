import { sql } from 'drizzle-orm';
import { pgTable, serial, text, timestamp, integer, jsonb, index, check } from 'drizzle-orm/pg-core';

export const deadLetterQueue = pgTable('dead_letter_queue', {
  id: serial('id').primaryKey(),
  signal: text('signal').notNull(), // trace, log, metric
  deliveryCount: integer('delivery_count').notNull(),
  reason: text('reason').notNull(),
  failedAt: timestamp('failed_at').notNull().defaultNow(),
  payload: jsonb('payload').notNull(),
  replayedAt: timestamp('replayed_at'),
  replayAttempts: integer('replay_attempts').default(0),
  replayError: text('replay_error'),
  replayStatus: text('replay_status').notNull().default('pending'),
  replayLeaseExpiresAt: timestamp('replay_lease_expires_at'),
  organizationId: text('organization_id'),
  projectId: text('project_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('dead_letter_queue_failed_at_idx').on(table.failedAt),
  index('dead_letter_queue_replay_status_idx').on(table.replayStatus),
  check('dead_letter_queue_replay_status_check', sql`${table.replayStatus} in ('pending', 'replaying', 'succeeded', 'failed')`),
]);
