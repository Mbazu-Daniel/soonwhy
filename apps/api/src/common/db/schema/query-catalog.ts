import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const schemaCatalog = pgTable(
  "schema_catalog",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    projectId: text("project_id").notNull(),
    dataType: text("data_type").notNull(), // logs, traces, metrics
    fieldName: text("field_name").notNull(),
    fieldType: text("field_type").notNull(), // string, number, boolean, array, object
    values: jsonb("values").array(), // Sample values for facets
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("schema_catalog_org_project_idx").on(table.orgId, table.projectId),
    index("schema_catalog_data_type_idx").on(table.dataType),
    index("schema_catalog_field_name_idx").on(table.fieldName),
  ],
);

export const savedQueries = pgTable(
  "saved_queries",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    projectId: text("project_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    dataType: text("data_type").notNull(),
    query: jsonb("query").notNull(), // KQL-like query structure
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("saved_queries_org_project_idx").on(table.orgId, table.projectId),
    index("saved_queries_data_type_idx").on(table.dataType),
  ],
);
