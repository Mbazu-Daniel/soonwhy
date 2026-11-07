import { generateId } from "../generate-id";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { projects } from "./projects";

export type NotificationChannelType = "email" | "slack" | "webhook";

export const notificationChannels = pgTable(
  "notification_channels",
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
    type: text("type", { enum: ["email", "slack", "webhook"] }).notNull(),
    // Email channel config
    fromEmail: text("from_email"),
    fromName: text("from_name"),
    recipientEmails: text("recipient_emails").array().default([]),
    // Slack channel config
    slackAccessToken: text("slack_access_token"), // encrypted at rest in production
    slackChannelId: text("slack_channel_id"), // e.g. C123 or DM user id
    slackUserId: text("slack_user_id"), // for DMs
    slackConnectedAt: timestamp("slack_connected_at"),
    // Webhook channel config
    webhookUrl: text("webhook_url"),
    webhookSecret: text("webhook_secret"), // HMAC secret for signature verification
    webhookTypes: text("webhook_types").array().default([]), // event types this webhook listens to
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notification_channels_project_name_idx").on(
      table.projectId,
      table.name,
    ),
    index("notification_channels_org_type_idx").on(table.orgId, table.type),
    index("notification_channels_project_active_idx").on(
      table.projectId,
      table.isActive,
    ),
  ],
);
