import { generateId } from "../generate-id";
import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { projects } from "./projects";

export const hosts = pgTable("hosts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  hostName: text("host_name").notNull(),
  organizationId: text("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("hosts_host_name_idx").on(table.hostName),
  index("hosts_project_id_idx").on(table.projectId),
]);
