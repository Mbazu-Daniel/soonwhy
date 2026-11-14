import { describe, expect, it } from "vitest";
import { deriveIssueState } from "./error-issue-state";

const resolvedAt = new Date("2026-11-14T10:00:00Z");

describe("deriveIssueState", () => {
  it("is unresolved when nothing is stored", () => {
    expect(deriveIssueState(undefined, "2026-11-14T11:00:00Z").status).toBe("unresolved");
  });

  it("stays resolved while the error has not been seen again", () => {
    expect(deriveIssueState({ status: "resolved", resolvedAt }, "2026-11-14T09:59:00Z")).toEqual({ status: "resolved", resolvedAt: resolvedAt.toISOString() });
  });

  it("flags a regression when it occurs after the resolution", () => {
    expect(deriveIssueState({ status: "resolved", resolvedAt }, "2026-11-14T10:00:01Z").status).toBe("regressed");
  });

  it("keeps an ignored issue ignored even when it recurs", () => {
    expect(deriveIssueState({ status: "ignored", resolvedAt: null }, "2026-11-15T00:00:00Z").status).toBe("ignored");
  });
});
