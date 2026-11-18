import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { generateId } from "../generate-id";
import { users } from "./auth";
import { organizations } from "./organizations";
import { projects } from "./projects";

export const errorIgnoreRules = pgTable(
  "error_ignore_rules",
  {
    id: text("id").primaryKey().$defaultFn(() => generateId()),
    orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    pathPattern: text("path_pattern").notNull(),
    status: text("status"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("error_ignore_rules_project_idx").on(table.orgId, table.projectId)],
);

export type ErrorIgnoreRuleRow = typeof errorIgnoreRules.$inferSelect;
