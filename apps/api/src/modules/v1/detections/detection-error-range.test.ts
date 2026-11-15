import { describe, expect, it, vi } from "vitest";
import { searchServiceBuckets } from "./detection-search.methods";
import { SERVER_ERROR_RANGE, errorCount } from "./detection.types";

describe("server error aggregation", () => {
  it("counts the 500 to 599 bucket", () => {
    expect(errorCount({ errors: { buckets: [{ doc_count: 4 }] } })).toBe(4);
    expect(errorCount({})).toBe(0);
  });

  it("asks Quickwit for a range aggregation, not a filter aggregation", async () => {
    const search = vi.fn().mockResolvedValue({ aggregations: {} });
    await searchServiceBuckets({ search } as never, "o1", "p1", 0, 1);
    const aggs = search.mock.calls[0]?.[1]?.aggregations.services.aggs;
    expect(aggs.errors).toEqual(SERVER_ERROR_RANGE);
    expect(JSON.stringify(aggs.errors)).not.toContain("filter");
  });
});
