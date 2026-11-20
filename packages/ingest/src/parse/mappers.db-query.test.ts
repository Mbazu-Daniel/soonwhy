import { describe, expect, it } from "vitest";
import { mapSpanToTraceRow } from "./mappers";

const organization = {
  organizationId: "org",
  projectId: "project",
  captureSettings: {
    redactSensitiveData: true,
    captureRequestHeaders: true,
    captureRequestBody: true,
    captureResponseBody: true,
    maxAttributeCount: 100,
    maxAttributeValueLength: 4096,
  },
} as never;

function databaseSpan(attributes: Record<string, unknown>) {
  return {
    traceId: "t", spanId: "s", parentSpanId: "", name: "query", kind: 3,
    startTimeUnixNano: "1700000000000000000", endTimeUnixNano: "1700000000100000000",
    status: { code: 1 }, resource: { attributes: {} }, attributes,
  } as never;
}

describe("stored database spans", () => {
  const row = mapSpanToTraceRow(
    databaseSpan({
      "db.system": "postgresql",
      "db.statement": "SELECT * FROM users WHERE note = 'my private note' AND id = 42",
      "db.query.text": "UPDATE accounts SET owner = 'Jane Doe' WHERE id = 7 -- reviewed by ops",
    }),
    organization,
  ) as Record<string, unknown> & { attributes: Record<string, string> };

  it("keeps no literal value in the stored query text", () => {
    expect(row.dbQueryText).toBe("UPDATE accounts SET owner = ? WHERE id = ?");
  });

  it("keeps no literal value in the raw statement attributes either", () => {
    const stored = JSON.stringify(row.attributes);
    for (const secret of ["my private note", "Jane Doe", "reviewed by ops", "42", "= 7"]) {
      expect(stored).not.toContain(secret);
    }
    expect(row.attributes["db.statement"]).toBe("SELECT * FROM users WHERE note = ? AND id = ?");
  });
});
