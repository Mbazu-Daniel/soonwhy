import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const projectSettings = pgTable("project_settings", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  redactSensitiveData: boolean("redact_sensitive_data").default(true).notNull(),
  captureRequestHeaders: boolean("capture_request_headers")
    .default(true)
    .notNull(),
  captureRequestBody: boolean("capture_request_body").default(true).notNull(),
  captureResponseBody: boolean("capture_response_body")
    .default(true)
    .notNull(),
  maxAttributeCount: integer("max_attribute_count").default(100).notNull(),
  maxAttributeValueLength: integer("max_attribute_value_length")
    .default(4096)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
