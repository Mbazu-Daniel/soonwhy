import { generateId } from "../generate-id";
import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { projects } from "./projects";

export const capacityMetrics = pgTable(
  "capacity_metrics",
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
    serviceName: text("service_name").notNull(),
    cpuPercent: integer("cpu_percent"),
    memoryPercent: integer("memory_percent"),
    memoryUsedMB: integer("memory_used_mb"),
    memoryTotalMB: integer("memory_total_mb"),
    eventLoopLagMs: integer("event_loop_lag_ms"),
    activeRequests: integer("active_requests"),
    maxConcurrency: integer("max_concurrency"),
    cpuExhausted: boolean("cpu_exhausted").notNull().default(false),
    memoryExhausted: boolean("memory_exhausted").notNull().default(false),
    eventLoopStalled: boolean("event_loop_stalled").notNull().default(false),
    concurrencyExceeded: boolean("concurrency_exceeded").notNull().default(false),
    metadata: jsonb("metadata"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
);
