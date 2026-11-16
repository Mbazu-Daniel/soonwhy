import { generateId } from "../generate-id";
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    source: text("source").notNull(),
    deliveryId: text("delivery_id").notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("webhook_deliveries_source_delivery_idx").on(
      table.source,
      table.deliveryId,
    ),
  ],
);
