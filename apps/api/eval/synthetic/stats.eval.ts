import { describe, expect, it } from "vitest";
import { mean, pairedBootstrap, reciprocalRank, wilson } from "./stats";

describe("wilson interval", () => {
  it("is the known interval for 8 of 10", () => {
    const interval = wilson(8, 10);
    expect(interval.value).toBeCloseTo(0.8, 5);
    expect(interval.low).toBeCloseTo(0.4902, 3);
    expect(interval.high).toBeCloseTo(0.9433, 3);
  });

  it("stays inside 0 and 1 at the extremes and does not collapse to a point", () => {
    expect(wilson(30, 30).high).toBe(1);
    expect(wilson(30, 30).low).toBeLessThan(1);
    expect(wilson(0, 30).low).toBe(0);
    expect(wilson(0, 30).high).toBeGreaterThan(0);
  });

  it("is empty for no samples", () => {
    expect(wilson(0, 0)).toEqual({ value: 0, low: 0, high: 0 });
  });
});

describe("reciprocal rank", () => {
  it("is 1 over the rank and 0 for a miss", () => {
    expect(reciprocalRank(1)).toBe(1);
    expect(reciprocalRank(4)).toBe(0.25);
    expect(reciprocalRank(null)).toBe(0);
    expect(mean([1, 0.5, 0])).toBe(0.5);
  });
});

describe("paired bootstrap", () => {
  const ones = Array.from({ length: 60 }, () => 1);
  const mixed = Array.from({ length: 60 }, (_, index) => (index % 4 === 0 ? 0 : 1));

  it("excludes zero when one method is consistently better", () => {
    const interval = pairedBootstrap(ones, mixed);
    expect(interval.value).toBeCloseTo(0.25, 5);
    expect(interval.low).toBeGreaterThan(0);
  });

  it("includes zero when the methods are identical", () => {
    const interval = pairedBootstrap(mixed, mixed);
    expect(interval).toEqual({ value: 0, low: 0, high: 0 });
  });

  it("includes zero when the differences are noise around zero", () => {
    const a = Array.from({ length: 40 }, (_, index) => (index % 2 === 0 ? 1 : 0));
    const b = Array.from({ length: 40 }, (_, index) => (index % 2 === 0 ? 0 : 1));
    const interval = pairedBootstrap(a, b);
    expect(interval.low).toBeLessThan(0);
    expect(interval.high).toBeGreaterThan(0);
  });

  it("is repeatable and rejects unpaired samples", () => {
    expect(pairedBootstrap(ones, mixed)).toEqual(pairedBootstrap(ones, mixed));
    expect(() => pairedBootstrap([1], [1, 2])).toThrow();
  });
});
