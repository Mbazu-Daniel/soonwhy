/**
 * Change-point detection using PELT (Pruned Exact Linear Time) algorithm approximation
 *
 * This implementation detects multiple change points in a time series using a binary segmentation
 * approach with penalty for each change point.
 *
 * @param values Time series values
 * @param penalty Penalty for each change point (typically log(n) or a custom value)
 * @returns Array of change point indices
 */
export function detectChangePoints(
  values: number[],
  penalty: number = Math.log(values.length),
): number[] {
  const n = values.length;

  if (n < 3) {
    return [];
  }

  // Calculate cumulative sum and cumulative sum of squares
  const cumSum: number[] = new Array(n + 1).fill(0);
  const cumSumSq: number[] = new Array(n + 1).fill(0);

  for (let i = 0; i < n; i++) {
    cumSum[i + 1] = cumSum[i]! + values[i]!;
    cumSumSq[i + 1] = cumSumSq[i]! + values[i]! * values[i]!;
  }

  // Calculate cost function: mean squared error for segment [i, j)
  // cost(i, j) = sum of squared errors / (j - i)
  function segmentCost(i: number, j: number): number {
    const length = j - i;
    if (length <= 1) return 0;

    const segmentSum = cumSum[j]! - cumSum[i]!;
    const segmentSumSq = cumSumSq[j]! - cumSumSq[i]!;

    // MSE = (sumSq - sum^2/n) / n
    return (segmentSumSq - Math.pow(segmentSum, 2) / length) / length;
  }

  // Exact PELT would be O(n^2), use binary segmentation approximation
  // for large datasets

  // Binary segmentation: recursively split at the point that minimizes cost + penalty
  const changePoints: number[] = [];

  function binarySearch(start: number, end: number, depth: number = 0): void {
    if (end - start <= 1) return;

    let bestCost = Infinity;
    let bestK = -1;

    // Try all possible split points
    for (let k = start + 1; k < end; k++) {
      const cost = segmentCost(start, k) + segmentCost(k, end) + penalty;
      if (cost < bestCost) {
        bestCost = cost;
        bestK = k;
      }
    }

    // If a change point is found and we haven't exceeded reasonable depth
    if (bestK > start && bestK < end && depth < 10) {
      changePoints.push(bestK);
      // Recursively search both halves, avoiding the change point itself
      binarySearch(start, bestK, depth + 1);
      binarySearch(bestK, end, depth + 1);
    }
  }

  binarySearch(0, n);

  // Sort and remove duplicates
  return [...new Set(changePoints.sort((a, b) => a - b))];
}

/**
 * Detect change points with automatic penalty selection using BIC (Bayesian Information Criterion)
 *
 * @param values Time series values
 * @returns Array of change point indices
 */
export function detectChangePointsBIC(values: number[]): number[] {
  const n = values.length;
  if (n < 3) return [];

  const penalty = Math.log(n) * 0.5; // BIC penalty
  return detectChangePoints(values, penalty);
}
