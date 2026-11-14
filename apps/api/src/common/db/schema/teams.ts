import { generateId } from "../generate-id";
import { pgTable, uniqueIndex, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const teams = pgTable("teams", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  orgId: text("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("teams_org_id_slug_idx").on(table.orgId, table.slug),
]);
