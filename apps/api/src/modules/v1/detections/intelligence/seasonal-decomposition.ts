/**
 * Seasonal decomposition using STL (Seasonal-Trend decomposition using Loess)
 */
export function basicSeasonalDecomposition(
  values: number[],
  period: number,
): {
  trend: number[];
  seasonal: number[];
  residual: number[];
} {
  const n = values.length;

  if (n < period * 2) {
    return {
      trend: values.map((v) => v),
      seasonal: values.map(() => 0),
      residual: values.map((v, i) => v),
    };
  }

  const trend: number[] = new Array(n).fill(0);
  const seasonals: number[] = new Array(n).fill(0);
  const residual: number[] = new Array(n).fill(0);

  const windowSize = period;

  for (let i = Math.floor(windowSize / 2); i < n - Math.floor(windowSize / 2); i++) {
    let sum = 0;
    let count = 0;
    for (
      let j = -Math.floor(windowSize / 2);
      j <= Math.ceil(windowSize / 2);
      j++
    ) {
      const idx = i + j;
      if (idx >= 0 && idx < n) {
        sum += values[idx]!;
        count++;
      }
    }
    trend[i] = count > 0 ? sum / count : values[i]!;
  }

  for (let i = 0; i < Math.floor(windowSize / 2); i++) {
    trend[i] = values[i]!;
    trend[n - 1 - i] = values[n - 1 - i]!;
  }

  const periodSums: number[] = new Array(period).fill(0);
  const periodCounts: number[] = new Array(period).fill(0);

  for (let i = 0; i < n; i++) {
    const phase = i % period;
    periodSums[phase]! += values[i]! - trend[i]!;
    periodCounts[phase]!++;
  }

  for (let p = 0; p < period; p++) {
    seasonals[p] = periodCounts[p]! > 0 ? periodSums[p]! / periodCounts[p]! : 0;
  }

  for (let i = 0; i < n; i++) {
    seasonals[i] = seasonals[i % period]!;
  }

  for (let i = 0; i < n; i++) {
    residual[i] = values[i]! - trend[i]! - seasonals[i]!;
  }

  return { trend, seasonal: seasonals, residual };
}

export function calculateSeasonalIndex(
  values: number[],
  period: number,
  index: number,
): number {
  const { seasonal } = basicSeasonalDecomposition(values, period);
  const avg =
    values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 1;
  return seasonal[index]! / avg;
}

export function calculateAnomalyScore(
  values: number[],
  period: number,
  index: number,
): number {
  const { residual } = basicSeasonalDecomposition(values, period);

  if (residual.length === 0) return 0;

  const mean = residual.reduce((a, b) => a + b, 0) / residual.length;
  const variance =
    residual.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / residual.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  const zScore = (residual[index]! - mean) / stdDev;

  return Math.abs(zScore);
}
