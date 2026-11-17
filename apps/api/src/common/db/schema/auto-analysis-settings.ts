import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const autoAnalysisSettings = pgTable("auto_analysis_settings", {
  orgId: text("org_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").default(false).notNull(),
  dailyCap: integer("daily_cap").default(20).notNull(),
  minOccurrences: integer("min_occurrences").default(5).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AutoAnalysisSettingsRow = typeof autoAnalysisSettings.$inferSelect;
