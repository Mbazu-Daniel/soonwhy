import { generateId } from "../generate-id";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { projects } from "./projects";

export const dependencySnapshots = pgTable("dependency_snapshots", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  orgId: text("org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  serviceName: text("service_name").notNull(),
  ecosystem: text("ecosystem").notNull(),
  packages: jsonb("packages").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastScannedAt: timestamp("last_scanned_at"),
  lastScanError: text("last_scan_error"),
}, (table) => [
  uniqueIndex("dependency_snapshots_service_uidx").on(table.projectId, table.serviceName, table.ecosystem),
  index("dependency_snapshots_scan_idx").on(table.lastScannedAt),
]);

export type DependencySnapshot = typeof dependencySnapshots.$inferSelect;
