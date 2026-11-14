import { generateId } from "../generate-id";
import { pgTable, uniqueIndex, text, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const environments = pgTable("environments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  kind: text("kind").notNull().default("production"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("environments_project_id_slug_idx").on(table.projectId, table.slug),
]);
