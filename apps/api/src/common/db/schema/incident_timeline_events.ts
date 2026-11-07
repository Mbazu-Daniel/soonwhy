import { generateId } from "../generate-id";
import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { projects } from "./projects";

export type TimelineEventType =
  | "created"
  | "updated"
  | "resolved"
  | "reopened"
  | "assigned"
  | "unassigned"
  | "comment"
  | "notification_sent"
  | "severity_changed"
  | "state_change"
  | "ownership_transfer"
  | "status_update"
  | "custom";

export const incidentTimelineEvents = pgTable(
  "incident_timeline_events",
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
    incidentId: text("incident_id").notNull(), // references issue_lifecycles.id
    type: text("type", {
      enum: [
        "created",
        "updated",
        "resolved",
        "reopened",
        "assigned",
        "unassigned",
        "comment",
        "notification_sent",
        "severity_changed",
        "state_change",
        "ownership_transfer",
        "status_update",
        "custom",
      ] as const,
    }).notNull(),
    actorId: text("actor_id"), // user who triggered the event
    actorName: text("actor_name"),
    role: text("role"),
    message: text("message").notNull(),
    metadata: jsonb("metadata"), // structured extra data
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("incident_timeline_events_incident_idx").on(table.incidentId),
    index("incident_timeline_events_created_idx").on(
      table.incidentId,
      table.createdAt,
    ),
  ],
);
