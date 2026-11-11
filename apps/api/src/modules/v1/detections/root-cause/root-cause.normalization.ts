/**
 * Root Cause Signal Normalization
 *
 * Normalizes signal values to [0, 1] range.
 */

/**
 * Normalize a value to [0, 1] using min-max normalization
 */
export function normalizeMinMax(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Normalize using sigmoid function
 */
export function normalizeSigmoid(value: number, steepness: number = 1): number {
  return 1 / (1 + Math.exp(-steepness * value));
}

/**
 * Normalize using log transform for skewed distributions
 */
export function normalizeLog(value: number, base: number = 10): number {
  if (value <= 0) return 0;
  return Math.min(1, Math.log(value) / Math.log(base));
}

/**
 * Normalize percentage to [0, 1]
 */
export function normalizePercentage(percent: number): number {
  return Math.min(1, Math.max(0, percent / 100));
}

/**
 * Renormalize weights when some signals are missing
 */
export function renormalizeWeights(
  weights: Record<string, number>,
  availableSignals: string[],
): Record<string, number> {
  const totalWeight = Object.entries(weights)
    .filter(([key]) => availableSignals.includes(key))
    .reduce((sum, [, weight]) => sum + weight, 0);

  if (totalWeight === 0) return weights;

  const renormalized: Record<string, number> = {};
  for (const [key, weight] of Object.entries(weights)) {
    if (availableSignals.includes(key)) {
      renormalized[key] = weight / totalWeight;
    } else {
      renormalized[key] = 0;
    }
  }

  return renormalized;
}
