import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** Lookup tables used by ingest edge auth (not the full API schema). */
export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  scopes: text("scopes").array().default([]),
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projectSettings = pgTable("project_settings", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  redactSensitiveData: boolean("redact_sensitive_data").default(true).notNull(),
  captureRequestHeaders: boolean("capture_request_headers")
    .default(true)
    .notNull(),
  captureRequestBody: boolean("capture_request_body").default(true).notNull(),
  captureResponseBody: boolean("capture_response_body")
    .default(true)
    .notNull(),
  maxAttributeCount: integer("max_attribute_count").default(100).notNull(),
  maxAttributeValueLength: integer("max_attribute_value_length")
    .default(4096)
    .notNull(),
});

/** Mirrors apps/api dead_letter_queue; written by the ingest consumer. */
export const deadLetterQueue = pgTable("dead_letter_queue", {
  id: serial("id").primaryKey(),
  signal: text("signal").notNull(),
  deliveryCount: integer("delivery_count").notNull(),
  reason: text("reason").notNull(),
  failedAt: timestamp("failed_at").notNull().defaultNow(),
  payload: jsonb("payload").notNull(),
  replayed: boolean("replayed").notNull().default(false),
  replayedAt: timestamp("replayed_at"),
  replaySuccess: boolean("replay_success"),
  replayAttempts: integer("replay_attempts").default(0),
  replayError: text("replay_error"),
  organizationId: text("organization_id"),
  projectId: text("project_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
