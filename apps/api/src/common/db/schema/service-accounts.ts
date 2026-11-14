import { generateId } from "../generate-id";
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const serviceAccounts = pgTable(
  "service_accounts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    organizationId: text("organization_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdBy: text("created_by"),
    disabledAt: timestamp("disabled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("service_accounts_org_name_idx").on(table.organizationId, table.name),
  ],
);
