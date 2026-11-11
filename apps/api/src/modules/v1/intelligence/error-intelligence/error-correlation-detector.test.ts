import { describe, expect, it } from "vitest";
import {
  detectErrorClusters,
  detectErrorFrequencyTrend,
} from "./error-correlation-detector";
import type { ErrorOccurrence } from "./error-intelligence.types";

function occurrence(timestamp: string, fingerprint = "fp-1"): ErrorOccurrence {
  return {
    errorFingerprint: fingerprint,
    errorType: "TypeError",
    errorMessage: "cannot read property",
    timestamp,
  };
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

describe("detectErrorFrequencyTrend", () => {
  it("reports an increasing trend when the second half dominates", () => {
    const occurrences = [occurrence(minutesAgo(12)), occurrence(minutesAgo(2)), occurrence(minutesAgo(3)), occurrence(minutesAgo(4))];

    expect(detectErrorFrequencyTrend(occurrences, 15)).toBe("increasing");
  });

  it("reports a decreasing trend when the first half dominates", () => {
    const occurrences = [
      occurrence(minutesAgo(12)),
      occurrence(minutesAgo(11)),
      occurrence(minutesAgo(10)),
      occurrence(minutesAgo(2)),
    ];

    expect(detectErrorFrequencyTrend(occurrences, 15)).toBe("decreasing");
  });

  it("reports a stable trend for balanced halves", () => {
    const occurrences = [occurrence(minutesAgo(12)), occurrence(minutesAgo(2))];

    expect(detectErrorFrequencyTrend(occurrences, 15)).toBe("stable");
  });

  it("treats sparse samples as stable", () => {
    expect(detectErrorFrequencyTrend([], 15)).toBe("stable");
    expect(detectErrorFrequencyTrend([occurrence(minutesAgo(1))], 15)).toBe("stable");
  });
});

describe("detectErrorClusters", () => {
  it("groups errors within the cluster window once the threshold is reached", () => {
    const base = Date.parse("2026-05-01T00:00:00.000Z");
    const occurrences = [
      occurrence(new Date(base).toISOString()),
      occurrence(new Date(base + 10_000).toISOString()),
      occurrence(new Date(base + 20_000).toISOString()),
      occurrence(new Date(base + 300_000).toISOString()),
    ];

    const clusters = detectErrorClusters(occurrences, 60_000, 3);

    expect(clusters).toEqual([
      {
        errorFingerprint: "fp-1",
        startTime: new Date(base).toISOString(),
        endTime: new Date(base + 20_000).toISOString(),
        count: 3,
      },
    ]);
  });

  it("separates fingerprints and ignores bursts below the threshold", () => {
    const base = Date.parse("2026-05-01T00:00:00.000Z");
    const occurrences = [
      occurrence(new Date(base).toISOString(), "fp-1"),
      occurrence(new Date(base + 1_000).toISOString(), "fp-2"),
      occurrence(new Date(base + 2_000).toISOString(), "fp-2"),
    ];

    expect(detectErrorClusters(occurrences, 60_000, 3)).toEqual([]);
  });
});
