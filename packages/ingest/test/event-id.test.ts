import { describe, expect, it } from "vitest";
import { stableEventId } from "../src/parse/event-id";

describe("stableEventId", () => {
  it("is stable across object key order", () => {
    const left = stableEventId(["log", { a: 1, b: 2 }]);
    const right = stableEventId(["log", { b: 2, a: 1 }]);
    expect(left).toBe(right);
  });

  it("changes when a stable field changes", () => {
    const left = stableEventId(["log", { message: "one" }]);
    const right = stableEventId(["log", { message: "two" }]);
    expect(left).not.toBe(right);
  });

  it("ignores undefined fields", () => {
    const left = stableEventId(["log", { a: 1, b: undefined }]);
    const right = stableEventId(["log", { a: 1 }]);
    expect(left).toBe(right);
  });
});
