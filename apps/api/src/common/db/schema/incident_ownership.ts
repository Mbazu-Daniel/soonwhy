import { generateId } from "../generate-id";
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { projects } from "./projects";
import { users } from "./auth";

export const incidentOwnership = pgTable(
  "incident_ownership",
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
    ownerId: text("owner_id")
      .references(() => users.id, { onDelete: "set null" })
      .notNull(),
    ownerName: text("owner_name").notNull(),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
    assignedBy: text("assigned_by"), // user id who assigned
    assignedByName: text("assigned_by_name"),
  },
  (table) => [
    uniqueIndex("incident_ownership_incident_idx").on(table.incidentId),
    index("incident_ownership_owner_idx").on(table.ownerId),
  ],
);
