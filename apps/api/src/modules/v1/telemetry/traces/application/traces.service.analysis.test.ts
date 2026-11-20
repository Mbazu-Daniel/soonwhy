import { describe, expect, it, vi } from "vitest";
import { TracesService } from "./traces.service";

const stored = JSON.stringify({ bytes: 40, format: "json", shape: { type: "object", fields: { token: { type: "string" } } } });

describe("TracesService.getTrace", () => {
  it("returns the tree with its query and payload analysis from one fetch", async () => {
    const getTraceSpans = vi.fn(async () => [
      { traceId: "t", spanId: "root", parentSpanId: "", name: "GET /orders", duration: 100, timestamp: "2026-11-20T00:00:00.000Z", service: "api", attributes: { "http.response.body": stored } },
      { traceId: "t", spanId: "db", parentSpanId: "root", name: "SELECT", duration: 30, timestamp: "2026-11-20T00:00:00.010Z", service: "pg", dbQueryText: "SELECT * FROM orders WHERE user_id = ?" },
    ]);
    const result = await new TracesService({ getTraceSpans } as never).getTrace("org", "project", "t");

    expect(getTraceSpans).toHaveBeenCalledTimes(1);
    expect(result.tree).toHaveLength(1);
    expect(result.queries).toMatchObject({ queryCount: 1, totalQueryMs: 30 });
    expect(result.payloads.map((p) => p.issues[0]?.path)).toEqual(["token"]);
  });
});
