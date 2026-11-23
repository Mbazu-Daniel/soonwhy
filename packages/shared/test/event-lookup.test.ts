import { describe, expect, it } from "vitest";
import {
  commitTimeoutOf,
  duplicateAggregation,
  duplicateReport,
  escapeQueryTerm,
  eventIdQuery,
  foundEventIds,
  QUICKWIT_DEFAULT_COMMIT_TIMEOUT_SECS,
} from "../src/quickwit/event-lookup";

describe("eventIdQuery", () => {
  it("joins quoted terms with OR", () => {
    expect(eventIdQuery(["a1", "b2"])).toBe('eventId:"a1" OR eventId:"b2"');
  });

  it("escapes quotes and backslashes so an id cannot change the query", () => {
    expect(escapeQueryTerm('x"y\\z')).toBe('x\\"y\\\\z');
    expect(eventIdQuery(['a" OR eventId:"b'])).toBe('eventId:"a\\" OR eventId:\\"b"');
  });
});

describe("foundEventIds", () => {
  it("reads the keys of the aggregation buckets", () => {
    const response = { num_hits: 2, aggregations: { found: { buckets: [{ key: "a", doc_count: 1 }, { key: "b", doc_count: 3 }] } } };

    expect([...foundEventIds(response)]).toEqual(["a", "b"]);
  });

  it("returns an empty set for an empty bucket list or an empty result", () => {
    expect(foundEventIds({ num_hits: 0, aggregations: { found: { buckets: [] } } }).size).toBe(0);
    expect(foundEventIds({ num_hits: 0 }).size).toBe(0);
  });

  it("refuses a response that has hits but no aggregation", () => {
    expect(() => foundEventIds({ num_hits: 3 })).toThrow(/aggregation/);
  });
});

describe("commitTimeoutOf", () => {
  it("reads the configured commit timeout", () => {
    expect(commitTimeoutOf({ indexing_settings: { commit_timeout_secs: 90 } })).toBe(90);
  });

  it.each([undefined, {}, { indexing_settings: {} }, { indexing_settings: { commit_timeout_secs: 0 } }, { indexing_settings: { commit_timeout_secs: "60" } }])(
    "falls back to the Quickwit default for %j",
    (config) => {
      expect(commitTimeoutOf(config as never)).toBe(QUICKWIT_DEFAULT_COMMIT_TIMEOUT_SECS);
    },
  );
});

describe("duplicate report", () => {
  it("counts duplicated ids and the extra copies they carry", () => {
    const report = duplicateReport(
      { num_hits: 6, aggregations: { duplicates: { buckets: [{ key: "a", doc_count: 3 }, { key: "c", doc_count: 2 }] } } },
      1000,
    );

    expect(report).toEqual({ documents: 6, duplicateEventIds: 2, extraCopies: 3, truncated: false });
  });

  it("flags a truncated report when the bucket limit is reached", () => {
    const buckets = [{ key: "a", doc_count: 2 }, { key: "b", doc_count: 2 }];

    expect(duplicateReport({ num_hits: 4, aggregations: { duplicates: { buckets } } }, 2).truncated).toBe(true);
  });

  it("reports zero for an empty window", () => {
    expect(duplicateReport({ num_hits: 0 }, 1000)).toEqual({ documents: 0, duplicateEventIds: 0, extraCopies: 0, truncated: false });
  });

  it("refuses to call a window clean when hits came back without the aggregation", () => {
    expect(() => duplicateReport({ num_hits: 5 }, 1000)).toThrow(/expected aggregation/);
  });

  it("asks only for ids seen at least twice", () => {
    expect(duplicateAggregation(10)).toEqual({ duplicates: { terms: { field: "eventId", size: 10, min_doc_count: 2 } } });
  });
});
