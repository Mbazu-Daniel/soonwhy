import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { generateId } from "../generate-id";
import { users } from "./auth";
import { organizations } from "./organizations";
import { projects } from "./projects";

export type StoredErrorIssueStatus = "resolved" | "ignored";

export const errorIssueStates = pgTable(
  "error_issue_states",
  {
    id: text("id").primaryKey().$defaultFn(() => generateId()),
    orgId: text("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    status: text("status").$type<StoredErrorIssueStatus>().notNull(),
    resolvedAt: timestamp("resolved_at"),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("error_issue_states_key").on(table.orgId, table.projectId, table.fingerprint),
    index("error_issue_states_project_idx").on(table.orgId, table.projectId),
  ],
);

export type ErrorIssueStateRow = typeof errorIssueStates.$inferSelect;
