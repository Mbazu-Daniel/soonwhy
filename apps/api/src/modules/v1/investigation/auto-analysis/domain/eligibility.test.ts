import { describe, expect, it } from "vitest";
import { isMeaningfulGroup } from "./eligibility";

const base = { count: 1, scannerProbe: false, issue: { status: "unresolved" as const, resolvedAt: null } };

describe("isMeaningfulGroup", () => {
  it("analyzes a 5xx however few occurrences it has", () => {
    expect(isMeaningfulGroup({ ...base, errorType: "HTTP 500" }, 5)).toBe(true);
  });

  it("analyzes a thrown exception", () => {
    expect(isMeaningfulGroup({ ...base, errorType: "TypeError" }, 5)).toBe(true);
  });

  it("never analyzes a 404 even when it is frequent", () => {
    expect(isMeaningfulGroup({ ...base, errorType: "HTTP 404", count: 5000 }, 5)).toBe(false);
  });

  it("analyzes another 4xx only once it reaches the occurrence threshold", () => {
    expect(isMeaningfulGroup({ ...base, errorType: "HTTP 422", count: 4 }, 5)).toBe(false);
    expect(isMeaningfulGroup({ ...base, errorType: "HTTP 422", count: 5 }, 5)).toBe(true);
  });

  it("never analyzes a scanner probe", () => {
    expect(isMeaningfulGroup({ ...base, errorType: "HTTP 500", scannerProbe: true }, 5)).toBe(false);
  });

  it("skips resolved and ignored issues", () => {
    expect(isMeaningfulGroup({ ...base, errorType: "HTTP 500", issue: { status: "resolved", resolvedAt: null } }, 5)).toBe(false);
    expect(isMeaningfulGroup({ ...base, errorType: "HTTP 500", issue: { status: "ignored", resolvedAt: null } }, 5)).toBe(false);
  });

  it("still analyzes a regressed issue", () => {
    expect(isMeaningfulGroup({ ...base, errorType: "HTTP 500", issue: { status: "regressed", resolvedAt: null } }, 5)).toBe(true);
  });
});
