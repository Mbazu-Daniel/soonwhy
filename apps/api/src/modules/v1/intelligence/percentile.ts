export function percentile(
  values: number[],
  percentileRank: number,
): number | undefined {
  const finite = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  if (!finite.length) return undefined;

  const rank = Math.min(1, Math.max(0, percentileRank));
  const index = (finite.length - 1) * rank;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return finite[lower];

  const weight = index - lower;
  const lowerValue = finite[lower]!;
  const upperValue = finite[upper]!;
  return lowerValue + (upperValue - lowerValue) * weight;
}
