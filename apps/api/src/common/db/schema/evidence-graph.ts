import { pgTable, text, timestamp, jsonb, index, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const evidenceNodes = pgTable(
  "evidence_nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull().unique(),
    nodeType: text("node_type").notNull(),
    identity: jsonb("identity").notNull(),
    data: jsonb("data").notNull(),
    timestamp: timestamp("timestamp").notNull(),
    traceId: text("trace_id"),
    serviceName: text("service_name"),
    deploymentId: text("deployment_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => ({
    orgIdx: index("evidence_nodes_org_idx").on(table.organizationId),
    nodeIdx: index("evidence_nodes_node_idx").on(table.nodeId),
    traceIdx: index("evidence_nodes_trace_idx").on(table.traceId),
    serviceIdx: index("evidence_nodes_service_idx").on(table.serviceName),
    deploymentIdx: index("evidence_nodes_deployment_idx").on(table.deploymentId),
    expiresIdx: index("evidence_nodes_expires_idx").on(table.expiresAt),
  }),
);

export const evidenceEdges = pgTable(
  "evidence_edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    edgeId: text("edge_id").notNull().unique(),
    sourceNodeId: text("source_node_id").notNull(),
    targetNodeId: text("target_node_id").notNull(),
    edgeType: text("edge_type").notNull(),
    strength: text("strength").notNull(), // Store as string to avoid precision issues
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => ({
    orgIdx: index("evidence_edges_org_idx").on(table.organizationId),
    edgeIdx: index("evidence_edges_edge_idx").on(table.edgeId),
    sourceIdx: index("evidence_edges_source_idx").on(table.sourceNodeId),
    targetIdx: index("evidence_edges_target_idx").on(table.targetNodeId),
    expiresIdx: index("evidence_edges_expires_idx").on(table.expiresAt),
  }),
);
