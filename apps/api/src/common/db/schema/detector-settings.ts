import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export type DetectorConfigRow = {
  enabled?: boolean;
  thresholds?: Record<string, number>;
};

export const detectorSettings = pgTable("detector_settings", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  detectors: jsonb("detectors")
    .$type<Record<string, DetectorConfigRow>>()
    .notNull()
    .default({}),
  featureFlags: jsonb("feature_flags")
    .$type<Record<string, boolean>>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
