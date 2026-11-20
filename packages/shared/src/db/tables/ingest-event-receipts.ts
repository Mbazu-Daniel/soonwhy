import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const ingestEventReceipts = pgTable(
  "ingest_event_receipts",
  {
    eventId: text("event_id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    projectId: text("project_id").notNull(),
    signal: text("signal").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    committedAt: timestamp("committed_at"),
  },
  (table) => [
    index("ingest_event_receipts_created_at_idx").on(table.createdAt),
    index("ingest_event_receipts_status_idx").on(table.status),
  ],
);
