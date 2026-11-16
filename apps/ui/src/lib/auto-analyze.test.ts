import { describe, expect, it } from "vitest";
import { analysisLookup, shouldAutoAnalyze } from "./auto-analyze";

const base = { findingId: "f-1", isLoading: false, isError: false, data: null };

describe("analysisLookup", () => {
  it("treats an error with no finding yet as missing", () => {
    expect(analysisLookup({ ...base, findingId: null })).toBe("missing");
  });

  it("waits while the saved analysis is still loading", () => {
    expect(analysisLookup({ ...base, isLoading: true })).toBe("loading");
  });

  it("finds an analysis that was saved before", () => {
    expect(analysisLookup({ ...base, data: { summary: "x" } })).toBe("found");
  });

  it("treats an empty answer as missing", () => {
    expect(analysisLookup(base)).toBe("missing");
  });

  it("treats a 404 as missing", () => {
    expect(analysisLookup({ ...base, isError: true, status: 404 })).toBe("missing");
  });

  it("does not treat a server or network failure as missing", () => {
    expect(analysisLookup({ ...base, isError: true, status: 500 })).toBe("failed");
    expect(analysisLookup({ ...base, isError: true })).toBe("failed");
  });
});

describe("shouldAutoAnalyze", () => {
  it("starts once when there is no analysis yet", () => {
    expect(shouldAutoAnalyze("missing", null, "fp-1")).toBe(true);
  });

  it("does not start again for the same error", () => {
    expect(shouldAutoAnalyze("missing", "fp-1", "fp-1")).toBe(false);
  });

  it("starts for a different error after the user navigates", () => {
    expect(shouldAutoAnalyze("missing", "fp-1", "fp-2")).toBe(true);
  });

  it("never starts while loading, when found, or when the lookup failed", () => {
    for (const lookup of ["loading", "found", "failed"] as const) {
      expect(shouldAutoAnalyze(lookup, null, "fp-1")).toBe(false);
    }
  });
});
