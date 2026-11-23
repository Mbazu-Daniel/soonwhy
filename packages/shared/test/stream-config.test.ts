import { describe, expect, it } from "vitest";
import { NATS_DEFAULT_DUPLICATE_WINDOW_NS, resolveDuplicateWindowNs } from "../src/nats/stream-config";

const DAY_NS = 24 * 60 * 60 * 1_000_000_000;

describe("resolveDuplicateWindowNs", () => {
  it("defaults to one hour", () => {
    expect(resolveDuplicateWindowNs(undefined, DAY_NS)).toBe(NATS_DEFAULT_DUPLICATE_WINDOW_NS);
  });

  it("uses a valid configured value", () => {
    expect(resolveDuplicateWindowNs("120000000000", DAY_NS)).toBe(120_000_000_000);
  });

  it("falls back to the default for zero, negative or non-numeric values", () => {
    for (const value of ["0", "-5", "abc", ""]) {
      expect(resolveDuplicateWindowNs(value, DAY_NS)).toBe(NATS_DEFAULT_DUPLICATE_WINDOW_NS);
    }
  });

  it("never exceeds the stream max age", () => {
    expect(resolveDuplicateWindowNs(String(DAY_NS * 3), DAY_NS)).toBe(DAY_NS);
    expect(resolveDuplicateWindowNs(undefined, 1_000_000_000)).toBe(1_000_000_000);
  });
});
