import { getTableColumns, getTableName, type Table } from "drizzle-orm";
import { schema as sharedSchema } from "@soonwhy/shared";
import { describe, expect, it } from "vitest";
import * as apiSchema from "./schema";

const isTable = (value: unknown): value is Table =>
  typeof value === "object" && value !== null && Symbol.for("drizzle:IsDrizzleTable") in value;

const apiTables = new Map(
  Object.values(apiSchema)
    .filter(isTable)
    .map((table) => [getTableName(table), table]),
);

describe("shared lookup tables match the api schema", () => {
  const shared = Object.values(sharedSchema).filter(isTable);

  it("has shared tables to compare", () => {
    expect(shared.length).toBeGreaterThan(3);
  });

  for (const table of shared) {
    const name = getTableName(table);
    it(`${name}: every shared column exists in the api table with the same type`, () => {
      const api = apiTables.get(name);
      expect(api, `${name} is missing from the api schema`).toBeDefined();
      const apiColumns = Object.values(getTableColumns(api!)).map((column) => [column.name, column.getSQLType(), column.notNull] as const);
      for (const column of Object.values(getTableColumns(table))) {
        const match = apiColumns.find(([columnName]) => columnName === column.name);
        expect(match, `${name}.${column.name} is missing from the api schema`).toBeDefined();
        expect(match![1]).toBe(column.getSQLType());
      }
    });
  }
});
