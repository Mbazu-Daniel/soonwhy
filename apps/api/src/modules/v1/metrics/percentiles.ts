import type { HistogramSource } from "./percentiles.types";

export function histogramPercentile(
  bounds: number[],
  counts: number[],
  quantile: number,
): number {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) return 0;

  const target = (Math.min(100, Math.max(0, quantile)) / 100) * total;
  let cumulative = 0;

  for (let index = 0; index < counts.length; index++) {
    const count = counts[index] ?? 0;
    if (count <= 0) continue;
    cumulative += count;
    if (cumulative < target) continue;

    const lower = index === 0 ? 0 : (bounds[index - 1] ?? 0);
    const upper = bounds[index] ?? lower;
    const previous = cumulative - count;
    const fraction = count > 0 ? (target - previous) / count : 0;
    if (Number.isFinite(upper) && Number.isFinite(lower) && upper > lower)
      return lower + (upper - lower) * fraction;
    return Number.isFinite(lower) ? lower : upper;
  }

  return bounds[bounds.length - 1] ?? 0;
}

export function summaryPercentile(
  quantiles: Array<{ quantile: number; value: number }>,
  target: number,
): number {
  if (quantiles.length === 0) return 0;
  const sorted = [...quantiles].sort(
    (left, right) => left.quantile - right.quantile,
  );
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const normalized = target > 1 ? target / 100 : target;
  if (normalized <= first.quantile) return first.value;
  if (normalized >= last.quantile) return last.value;

  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    if (normalized > current.quantile) continue;
    const span = current.quantile - previous.quantile;
    if (span <= 0) return current.value;
    const fraction = (normalized - previous.quantile) / span;
    return previous.value + (current.value - previous.value) * fraction;
  }

  return last.value;
}

export function mergeHistogramSources(sources: HistogramSource[]): {
  bounds: number[];
  counts: number[];
  summaryQuantiles: Array<{ quantile: number; value: number }>;
  summaryCount: number;
} {
  let bounds: number[] = [];
  let counts: number[] = [];
  const summaryQuantiles: Array<{ quantile: number; value: number }> = [];
  let summaryCount = 0;

  for (const source of sources) {
    if (source.histogramExplicitBounds && source.histogramBucketCounts) {
      if (bounds.length === 0) {
        bounds = source.histogramExplicitBounds;
        counts = source.histogramBucketCounts.map(() => 0);
      }
      if (
        source.histogramExplicitBounds.length === bounds.length &&
        source.histogramBucketCounts.length === counts.length
      ) {
        source.histogramBucketCounts.forEach((count, index) => {
          counts[index] = (counts[index] ?? 0) + count;
        });
      }
    }
    if (source.summaryQuantiles) {
      summaryQuantiles.push(...source.summaryQuantiles);
      summaryCount += source.summaryCount ?? 0;
    }
  }

  return { bounds, counts, summaryQuantiles, summaryCount };
}
