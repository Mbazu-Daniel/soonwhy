import { generateId } from "../generate-id";
import { integer, jsonb, pgTable, text, timestamp, real, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { projects } from "./projects";
import { services } from "./services";
import { users } from "./auth";
import type { FindingCategory, FindingStatus } from "./finding-lifecycle";

export interface DetectionEvidence {
  kind: "metric" | "request" | "log" | "trace" | "recommendation";
  label: string;
  value: number | string;
  context?: Record<string, string | number | boolean | null>;
}

export const findings = pgTable("findings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  orgId: text("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  serviceId: text("service_id").references(() => services.id, {
    onDelete: "set null",
  }),
  serviceName: text("service_name").notNull(),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  observedValue: real("observed_value").notNull(),
  threshold: real("threshold").notNull(),
  unit: text("unit").notNull(),
  windowStart: timestamp("window_start").notNull(),
  windowEnd: timestamp("window_end").notNull(),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  evidence: jsonb("evidence").$type<DetectionEvidence[]>().notNull(),
  category: text("category").$type<FindingCategory>().default("performance").notNull(),
  status: text("status").$type<FindingStatus>().default("open").notNull(),
  fingerprint: text("fingerprint"),
  occurrences: integer("occurrences").default(1).notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by").references(() => users.id, { onDelete: "set null" }),
  recommendation: text("recommendation"),
}, (table) => [
  uniqueIndex("findings_project_fingerprint_uidx")
    .on(table.projectId, table.fingerprint)
    .where(sql`${table.fingerprint} is not null`),
  index("findings_project_status_idx").on(table.projectId, table.status),
  index("findings_org_project_idx").on(table.orgId, table.projectId),
  index("findings_service_id_idx")
    .on(table.serviceId)
    .where(sql`${table.serviceId} is not null`),
]);
