import { generateId } from "../generate-id";
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { projects } from "./projects";

export const alertSuppressionRules = pgTable(
  "alert_suppression_rules",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    orgId: text("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    description: text("description"),
    enabled: boolean("enabled").notNull().default(true),
    // Conditions for suppression
    conditions: jsonb("conditions").notNull(), // { services: [], severity: [], timeRanges: [], custom: [] }
    // Targeting
    targetAlertRuleIds: jsonb("target_alert_rule_ids").$type<string[]>(), // null = suppress all
    targetServices: jsonb("target_services").$type<string[]>(), // null = all services
    // Schedule
    scheduleType: text("schedule_type", { enum: ["always", "scheduled", "conditional"] }).notNull().default("always"),
    scheduleConfig: jsonb("schedule_config"), // For scheduled: { startTime, endTime, daysOfWeek, timezone }
    // Conditional config
    conditionalConfig: jsonb("conditional_config"), // For conditional: { metric, operator, threshold }
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);
