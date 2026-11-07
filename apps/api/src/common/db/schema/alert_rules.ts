import { generateId } from "../generate-id";
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { projects } from "./projects";

export type AlertRuleSeverity = "critical" | "high" | "medium" | "low";
export type AlertRuleStatus = "active" | "disabled";

export const alertRules = pgTable(
  "alert_rules",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    orgId: text("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // Severity routing: only notify at or above this severity
    minSeverity: text("min_severity", {
      enum: ["critical", "high", "medium", "low"],
    }).notNull(),
    // Which notification channel IDs to notify
    channelIds: text("channel_ids").array().default([]),
    status: text("status", { enum: ["active", "disabled"] })
      .default("active")
      .notNull(),
    // Dedupe window in seconds: suppress repeat alerts for same identity within this window
    dedupeWindowSeconds: integer("dedupe_window_seconds")
      .default(300)
      .notNull(),
    // JSON-encoded alert conditions (metric, operator, threshold, window, etc.)
    conditions: jsonb("conditions").default([]).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("alert_rules_org_project_idx").on(table.orgId, table.projectId),
    index("alert_rules_project_status_idx").on(table.projectId, table.status),
  ],
);
