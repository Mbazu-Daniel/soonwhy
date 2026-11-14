import { index, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const searchAudit = pgTable(
  "search_audit",
  {
    id: serial("id").primaryKey(),
    orgId: text("org_id").notNull(),
    projectId: text("project_id").notNull(),
    userId: text("user_id"),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    params: jsonb("params").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("search_audit_org_created_idx").on(table.orgId, table.createdAt.desc()),
  ],
);
