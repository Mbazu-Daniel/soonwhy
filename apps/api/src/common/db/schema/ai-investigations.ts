import { pgTable, text, timestamp, jsonb, index, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const aiInvestigations = pgTable(
  "ai_investigations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    investigationId: text("investigation_id").notNull().unique(),
    projectId: text("project_id").notNull(),
    status: text("status").notNull(), // pending, analyzing, complete, failed
    progress: text("progress").notNull(), // number as string
    currentStep: text("current_step"),
    result: jsonb("result"),
    error: text("error"),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("ai_investigations_org_idx").on(table.organizationId),
    projectIdx: index("ai_investigations_project_idx").on(table.projectId),
    statusIdx: index("ai_investigations_status_idx").on(table.status),
    investigationIdx: index("ai_investigations_investigation_idx").on(table.investigationId),
  }),
);
