import { generateId } from "../generate-id";
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const projects = pgTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  organizationId: text("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("projects_organization_id_name_idx").on(
    table.organizationId,
    table.name,
  ),
  uniqueIndex("projects_organization_id_slug_idx").on(
    table.organizationId,
    table.slug,
  ),
]);
