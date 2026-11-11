import { pgTable, text, timestamp, jsonb, index, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const deadLetterInvestigations = pgTable(
  "dead_letter_investigations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    investigationId: text("investigation_id").notNull(),
    projectId: text("project_id").notNull(),
    request: jsonb("request").notNull(),
    error: text("error").notNull(),
    attemptCount: text("attempt_count").notNull(),
    lastAttemptAt: timestamp("last_attempt_at").notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("dl_investigations_org_idx").on(table.organizationId),
    projectIdx: index("dl_investigations_project_idx").on(table.projectId),
    investigationIdx: index("dl_investigations_investigation_idx").on(table.investigationId),
    expiresIdx: index("dl_investigations_expires_idx").on(table.expiresAt),
  }),
);
