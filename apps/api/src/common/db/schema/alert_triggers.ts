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
import { alertRules } from "./alert_rules";

export type AlertTriggerStatus = "active" | "resolved";
export type AlertState = "healthy" | "pending" | "firing" | "no_data" | "error";

export const alertTriggers = pgTable(
  "alert_triggers",
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
    alertRuleId: text("alert_rule_id")
      .references(() => alertRules.id, { onDelete: "cascade" })
      .notNull(),
    alertName: text("alert_name").notNull(),
    triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
    status: text("status", { enum: ["active", "resolved"] })
      .default("active")
      .notNull(),
    state: text("state", { enum: ["healthy", "pending", "firing", "no_data", "error"] })
      .default("healthy")
      .notNull(),
    stateTransitionReason: text("state_transition_reason"),
    lastStateTransitionAt: timestamp("last_state_transition_at").defaultNow().notNull(),
    severity: text("severity", {
      enum: ["critical", "high", "medium", "low"],
    }).notNull(),
    streakCount: integer("streak_count").default(1).notNull(),
    lastStreakResetAt: timestamp("last_streak_reset_at").defaultNow().notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("alert_triggers_org_project_idx").on(table.orgId, table.projectId),
    index("alert_triggers_alert_rule_idx").on(table.alertRuleId),
    index("alert_triggers_triggered_at_idx").on(table.triggeredAt),
    index("alert_triggers_status_idx").on(table.status),
    index("alert_triggers_state_idx").on(table.state),
    index("alert_triggers_dedupe_idx").on(table.alertRuleId, table.orgId, table.projectId, table.status),
  ],
);
