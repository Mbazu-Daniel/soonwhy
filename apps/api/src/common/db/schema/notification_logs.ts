import { generateId } from "../generate-id";
import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { projects } from "./projects";
import { notificationChannels } from "./notification_channels";

export type NotificationChannelKind = "email" | "slack" | "webhook";
export type NotificationStatus = "sent" | "failed" | "pending";

export const notificationLogs = pgTable(
  "notification_logs",
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
    channelId: text("channel_id").references(() => notificationChannels.id, {
      onDelete: "set null",
    }),
    channelType: text("channel_type", {
      enum: ["email", "slack", "webhook"],
    }).notNull(),
    // What triggered this notification
    incidentId: text("incident_id"), // references issue_lifecycles.id
    alertRuleId: text("alert_rule_id"),
    status: text("status", { enum: ["sent", "failed", "pending"] })
      .default("pending")
      .notNull(),
    providerMessageId: text("provider_message_id"), // external id from zeptomail/slack
    error: text("error"),
    payload: jsonb("payload"), // what was sent
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notification_logs_org_created_idx").on(table.orgId, table.createdAt),
    index("notification_logs_project_status_idx").on(
      table.projectId,
      table.status,
    ),
    index("notification_logs_incident_idx").on(table.incidentId),
  ],
);

// Re-export for type use
export { notificationChannels } from "./notification_channels";
