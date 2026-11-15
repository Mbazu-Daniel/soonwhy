import { describe, expect, it } from "vitest";
import { integer, pgTable, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createIndexSql, plannedIndexes } from "./concurrent-indexes";

const events = pgTable("events", {
  id: integer("id").primaryKey(),
  orgId: text("org_id"),
  at: timestamp("at"),
}, (table) => [
  index("events_org_at_idx").on(table.orgId, table.at.desc()),
  uniqueIndex("events_org_id_idx").on(table.orgId, table.id),
]);

describe("concurrent index builds", () => {
  it("plans every named column index of a table, keeping column order and direction", () => {
    expect(plannedIndexes([events])).toEqual([
      { table: "events", name: "events_org_at_idx", unique: false, columns: ['"org_id"', '"at" DESC'] },
      { table: "events", name: "events_org_id_idx", unique: true, columns: ['"org_id"', '"id"'] },
    ]);
  });

  it("builds without blocking writes and does nothing if the index exists", () => {
    const [plan] = plannedIndexes([events]);
    expect(createIndexSql(plan!)).toBe('CREATE INDEX CONCURRENTLY IF NOT EXISTS "events_org_at_idx" ON "events" ("org_id", "at" DESC)');
  });

  it("plans the real schema without throwing", () => {
    const plans = plannedIndexes();
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((plan) => plan.columns.length > 0)).toBe(true);
  });
});
