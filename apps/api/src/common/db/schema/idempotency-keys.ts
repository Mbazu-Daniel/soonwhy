import type { IdempotencyStoredPayload } from "@nestjs/idempotency";
import { bigint, index, json, pgTable, text } from "drizzle-orm/pg-core";

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    keyHash: text("key_hash").primaryKey(),
    key: text("key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    owner: text("owner"),
    response: json("response").$type<IdempotencyStoredPayload>(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    expiresIdx: index("idempotency_keys_expires_at_idx").on(table.expiresAt),
  }),
);
