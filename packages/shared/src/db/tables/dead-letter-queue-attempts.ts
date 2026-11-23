import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const deadLetterQueueAttempts = pgTable('dead_letter_queue_attempts', {
  id: serial('id').primaryKey(),
  entryId: integer('entry_id').notNull(),
  attemptNumber: integer('attempt_number').notNull(),
  triggeredBy: text('triggered_by').notNull(),
  forced: boolean('forced').notNull().default(false),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  finishedAt: timestamp('finished_at'),
  outcome: text('outcome').notNull().default('started'),
  error: text('error'),
}, (table) => [
  uniqueIndex('dead_letter_queue_attempts_entry_attempt_uidx').on(table.entryId, table.attemptNumber),
  check('dead_letter_queue_attempts_outcome_check', sql`${table.outcome} in ('started', 'succeeded', 'failed', 'abandoned')`),
]);
