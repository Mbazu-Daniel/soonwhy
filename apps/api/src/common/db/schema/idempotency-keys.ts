import { pgTable, text, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull(),
    endpoint: text("endpoint").notNull(),
    payloadHash: text("payload_hash").notNull(),
    statusCode: text("status_code"),
    responseHeaders: jsonb("response_headers"),
    responseBody: text("response_body"),
    createdAt: timestamp("created_at").default(sql`now()`),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => ({
    scopeIdx: index("idempotency_keys_scope_idx").on(table.scope),
    expiresIdx: index("idempotency_keys_expires_idx").on(table.expiresAt),
    compositeIdx: index("idempotency_keys_composite_idx").on(
      table.scope,
      table.endpoint,
      table.payloadHash,
    ),
  }),
);
