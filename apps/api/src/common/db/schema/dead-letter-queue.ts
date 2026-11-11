import { pgTable, serial, text, timestamp, integer, jsonb, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const deadLetterQueue = pgTable('dead_letter_queue', {
  id: serial('id').primaryKey(),
  signal: text('signal').notNull(), // trace, log, metric
  deliveryCount: integer('delivery_count').notNull(),
  reason: text('reason').notNull(),
  failedAt: timestamp('failed_at').notNull().defaultNow(),
  payload: jsonb('payload').notNull(),
  replayed: boolean('replayed').notNull().default(false),
  replayedAt: timestamp('replayed_at'),
  replaySuccess: boolean('replay_success'),
  replayAttempts: integer('replay_attempts').default(0),
  replayError: text('replay_error'),
  organizationId: text('organization_id'),
  projectId: text('project_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
