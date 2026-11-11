import { describe, expect, it } from "vitest";
import {
  histogramPercentile,
  mergeHistogramSources,
  summaryPercentile,
} from "./percentiles";

describe("histogram percentiles", () => {
  it("interpolates a percentile inside an explicit bucket", () => {
    const bounds = [10, 50];
    const counts = [2, 5, 3];
    expect(histogramPercentile(bounds, counts, 50)).toBe(34);
    expect(histogramPercentile(bounds, counts, 95)).toBe(50);
  });

  it("returns zero when there are no observations", () => {
    expect(histogramPercentile([10], [0, 0], 50)).toBe(0);
  });

  it("merges histogram sources with the same bounds", () => {
    const merged = mergeHistogramSources([
      { histogramExplicitBounds: [10, 50], histogramBucketCounts: [1, 2, 1] },
      { histogramExplicitBounds: [10, 50], histogramBucketCounts: [1, 1, 1] },
    ]);
    expect(merged.bounds).toEqual([10, 50]);
    expect(merged.counts).toEqual([2, 3, 2]);
  });
});

describe("summary percentiles", () => {
  it("returns the nearest quantile at the edges", () => {
    const quantiles = [
      { quantile: 0.5, value: 80 },
      { quantile: 0.95, value: 180 },
      { quantile: 0.99, value: 200 },
    ];
    expect(summaryPercentile(quantiles, 50)).toBe(80);
    expect(summaryPercentile(quantiles, 99)).toBe(200);
  });

  it("interpolates between summary quantiles", () => {
    const quantiles = [
      { quantile: 0.5, value: 80 },
      { quantile: 0.95, value: 180 },
    ];
    const value = summaryPercentile(quantiles, 72.5);
    expect(value).toBeCloseTo(130);
  });
});
