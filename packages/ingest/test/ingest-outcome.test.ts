import { describe, expect, it } from "vitest";
import { AmbiguousIngestResultError, splitIngestOutcome } from "../src/pipeline/ingest-outcome";

const rows = [
  { eventId: "a", message: "one" },
  { eventId: "b", message: "two" },
  { eventId: "c", message: "three" },
];

const failure = (document: string) => ({ document, reason: "invalid_schema", message: "bad" });

describe("splitIngestOutcome", () => {
  it("accepts every row when nothing was rejected", () => {
    const outcome = splitIngestOutcome(rows, { received: 3, ingested: 3, rejected: [] });

    expect(outcome.accepted).toEqual(rows);
    expect(outcome.rejected).toEqual([]);
  });

  it("matches a rejected document to its row by the exact line", () => {
    const outcome = splitIngestOutcome(rows, { received: 3, ingested: 2, rejected: [failure(JSON.stringify(rows[1]))] });

    expect(outcome.accepted.map((row) => row.eventId)).toEqual(["a", "c"]);
    expect(outcome.rejected).toEqual([{ row: rows[1], reason: "invalid_schema", message: "bad" }]);
  });

  it("falls back to the event id when the document text was reformatted", () => {
    const reformatted = JSON.stringify(rows[2], null, 2);

    const outcome = splitIngestOutcome(rows, { received: 3, ingested: 2, rejected: [failure(reformatted)] });

    expect(outcome.rejected[0]!.row.eventId).toBe("c");
  });

  it("refuses a result that does not account for every row", () => {
    expect(() => splitIngestOutcome(rows, { received: 3, ingested: 1, rejected: [] })).toThrow(AmbiguousIngestResultError);
    expect(() => splitIngestOutcome(rows, { received: 3, ingested: 3, rejected: [failure(JSON.stringify(rows[0]))] })).toThrow(
      AmbiguousIngestResultError,
    );
  });

  it("refuses a rejected document it cannot match", () => {
    expect(() => splitIngestOutcome(rows, { received: 3, ingested: 2, rejected: [failure("{}")] })).toThrow(
      AmbiguousIngestResultError,
    );
    expect(() => splitIngestOutcome(rows, { received: 3, ingested: 2, rejected: [failure("not json")] })).toThrow(
      AmbiguousIngestResultError,
    );
  });

  it("refuses a result that lists one rejected document twice", () => {
    const line = JSON.stringify(rows[0]);

    expect(() => splitIngestOutcome(rows, { received: 3, ingested: 1, rejected: [failure(line), failure(line)] })).toThrow(
      AmbiguousIngestResultError,
    );
  });
});
