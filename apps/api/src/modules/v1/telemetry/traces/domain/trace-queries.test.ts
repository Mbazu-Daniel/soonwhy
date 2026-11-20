import { describe, expect, it } from "vitest";
import { analyzeTraceQueries, describeQuery } from "./trace-queries";

const span = (spanId: string, dbQueryText: string, duration: number) => ({ spanId, dbQueryText, duration });

describe("describeQuery", () => {
  it("reads operation, table and filtered columns", () => {
    expect(describeQuery('SELECT * FROM "order_items" WHERE order_id = ? AND status IN (?, ?) ORDER BY id')).toMatchObject({
      operation: "SELECT", table: "order_items", filterColumns: ["order_id", "status"], hasWhere: true,
    });
  });

  it("reads the qualified column name only", () => {
    expect(describeQuery("UPDATE orders o SET x = ? WHERE o.id = ?").filterColumns).toEqual(["id"]);
  });
});

describe("analyzeTraceQueries", () => {
  it("groups identical queries and ranks them by total time", () => {
    const spans = [
      span("a", "SELECT * FROM users WHERE id = ?", 10),
      span("b", "SELECT * FROM users WHERE id = ?", 20),
      span("c", "SELECT * FROM orders WHERE user_id = ?", 100),
      { spanId: "d", duration: 5, name: "GET /x" },
    ];
    const summary = analyzeTraceQueries(spans, 400);
    expect(summary.queryCount).toBe(3);
    expect(summary.totalQueryMs).toBe(130);
    expect(summary.queries.map((q) => q.table)).toEqual(["orders", "users"]);
    expect(summary.queries[1]).toMatchObject({ count: 2, totalMs: 30, maxMs: 20, avgMs: 15 });
    expect(summary.queries[0]!.shareOfTrace).toBeCloseTo(0.25);
  });

  it("flags a repeated query as a batching opportunity", () => {
    const spans = Array.from({ length: 8 }, (_, i) => span(`s${i}`, "SELECT * FROM order_items WHERE order_id = ?", 5));
    const [query] = analyzeTraceQueries(spans, 1000).queries;
    expect(query!.hints.map((h) => h.kind)).toEqual(["repeated", "index"]);
    expect(query!.hints[0]!.message).toContain("8 times");
    expect(query!.hints[1]!.message).toContain("order_items by order_id");
  });

  it("suggests an index check for a slow filtered query but not a fast one", () => {
    const slow = analyzeTraceQueries([span("a", "SELECT * FROM events WHERE user_id = ?", 450)], 500).queries[0]!;
    const fast = analyzeTraceQueries([span("a", "SELECT * FROM events WHERE user_id = ?", 3)], 500).queries[0]!;
    expect(slow.hints.map((h) => h.kind)).toEqual(["index"]);
    expect(fast.hints).toEqual([]);
  });

  it("warns about an unfiltered select with no limit", () => {
    const [query] = analyzeTraceQueries([span("a", "SELECT id, name FROM customers", 8)], 100).queries;
    expect(query!.hints.map((h) => h.kind)).toEqual(["unfiltered"]);
  });

  it("falls back to the raw attributes and ignores spans with no query", () => {
    const summary = analyzeTraceQueries([{ spanId: "a", duration: 4, attributes: { "db.statement": "DELETE FROM t WHERE id = ?" } }, { spanId: "b", duration: 1 }], 10);
    expect(summary.queries).toHaveLength(1);
    expect(summary.queries[0]!.operation).toBe("DELETE");
  });

  it("copes with a zero-length trace", () => {
    expect(analyzeTraceQueries([span("a", "SELECT 1", 0)], 0).queries[0]!.shareOfTrace).toBe(0);
  });
});
