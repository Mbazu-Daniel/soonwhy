import { generateId } from "../generate-id";
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { projects } from "./projects";

export type WebhookEndpointType =
  | "incident.created"
  | "incident.updated"
  | "incident.resolved"
  | "incident.reopened"
  | "alert.triggered"
  | "alert.resolved"
  | "finding.detected"
  | "weekly.summary";

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
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
    url: text("url").notNull(),
    secret: text("secret"), // HMAC secret for signing payloads
    // Event types this endpoint listens to. User selects which webhooks they want to listen to.
    types: text("types", {
      enum: [
        "incident.created",
        "incident.updated",
        "incident.resolved",
        "incident.reopened",
        "alert.triggered",
        "alert.resolved",
        "finding.detected",
        "weekly.summary",
      ] as const,
    })
      .array()
      .default([]),
    isActive: boolean("is_active").default(true).notNull(),
    lastTriggeredAt: timestamp("last_triggered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("webhook_endpoints_org_project_idx").on(table.orgId, table.projectId),
    index("webhook_endpoints_project_active_idx").on(
      table.projectId,
      table.isActive,
    ),
  ],
);
