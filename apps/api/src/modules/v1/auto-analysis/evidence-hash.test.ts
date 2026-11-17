import { describe, expect, it } from "vitest";
import { evidenceHash } from "./evidence-hash";

const evidence = (count: number, frames = "at a.ts:1") => [
  { kind: "metric" as const, label: "Occurrences", value: count },
  { kind: "log" as const, label: "Application frames", value: frames },
];

describe("evidenceHash", () => {
  it("does not change when only the occurrence count grows", () => {
    expect(evidenceHash({ title: "t", evidence: evidence(5) })).toBe(evidenceHash({ title: "t", evidence: evidence(500) }));
  });

  it("changes when the stack frames change", () => {
    expect(evidenceHash({ title: "t", evidence: evidence(5) })).not.toBe(evidenceHash({ title: "t", evidence: evidence(5, "at b.ts:9") }));
  });

  it("changes when the title changes", () => {
    expect(evidenceHash({ title: "a", evidence: evidence(5) })).not.toBe(evidenceHash({ title: "b", evidence: evidence(5) }));
  });
});
