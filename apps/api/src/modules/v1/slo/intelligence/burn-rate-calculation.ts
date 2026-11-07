/**
 * Burn rate calculation for SLO error budgets
 *
 * Burn rate = (actual error rate) / (SLO error rate)
 * - burn rate > 1: consuming error budget faster than SLO allows
 * - burn rate = 1: consuming error budget at the expected rate
 * - burn rate < 1: consuming error budget slower than SLO allows
 *
 * @param currentErrorCount Current error count in period
 * @param currentErrorThreshold SLO error threshold in period
 * @param periodStart Start of the measurement period
 * @param periodEnd End of the measurement period
 * @param sloTarget SLO target error rate (e.g., 0.01 for 99% availability)
 * @returns Burn rate value and status
 */
export interface BurnRateResult {
  burnRate: number;
  status: "healthy" | "caution" | "critical";
  percentageOfBudgetConsumed: number;
  estimatedTimeToExhaustion?: number; // in hours
}

export type { ErrorBudgetStatus } from "./error-budget";
export { updateErrorBudgetStatus } from "./error-budget";

/**
 * Calculate burn rate based on error counts and SLO target
 */
export function calculateBurnRate(
  currentErrorCount: number,
  currentErrorThreshold: number,
  periodStart: Date,
  periodEnd: Date,
  sloTarget: number,
): BurnRateResult {
  const now = new Date();
  const periodMs = periodEnd.getTime() - periodStart.getTime();
  const elapsedMs = now.getTime() - periodStart.getTime();
  const totalPeriodMs = periodEnd.getTime() - periodStart.getTime();

  // Calculate actual error rate
  const actualErrorRate = currentErrorCount / (elapsedMs / totalPeriodMs || 1);

  // SLO error rate (what the SLO allows)
  const sloErrorRate = sloTarget;

  // Burn rate = actual / SLO
  const burnRate = actualErrorRate / sloErrorRate;

  // Calculate percentage of budget consumed
  // If burn rate > 1, we're consuming faster than allocated
  const nowInPeriod = elapsedMs / totalPeriodMs;
  let percentageOfBudgetConsumed: number;

  if (burnRate >= 1) {
    // We've consumed more than our allocated portion
    percentageOfBudgetConsumed = Math.min(100, nowInPeriod * burnRate * 100);
  } else {
    // We're consuming slower, proportionally less budget used
    percentageOfBudgetConsumed = nowInPeriod * 100;
  }

  // Determine status
  let status: "healthy" | "caution" | "critical";
  if (burnRate >= 3) {
    status = "critical";
  } else if (burnRate >= 2) {
    status = "caution";
  } else {
    status = "healthy";
  }

  // Estimate time to exhaustion at current rate
  let estimatedTimeToExhaustion: number | undefined;
  const remainingBudgetPercentage = 100 - percentageOfBudgetConsumed;
  if (burnRate > 0 && remainingBudgetPercentage > 0) {
    // Time until budget is exhausted at current burn rate
    const hoursInPeriod = totalPeriodMs / (1000 * 60 * 60);
    const hoursRemainingInPeriod = hoursInPeriod * (1 - nowInPeriod);
    const hoursToExhaustion =
      (remainingBudgetPercentage / burnRate) * hoursInPeriod;
    estimatedTimeToExhaustion = hoursToExhaustion;
  }

  return {
    burnRate,
    status,
    percentageOfBudgetConsumed:
      Math.round(percentageOfBudgetConsumed * 100) / 100,
    estimatedTimeToExhaustion: estimatedTimeToExhaustion
      ? Math.round(estimatedTimeToExhaustion * 100) / 100
      : undefined,
  };
}

/**
 * Get burn rate from repository data
 */
export async function getBurnRateFromRepository(
  repository: any,
  orgId: string,
  projectId: string,
  sloTarget: number,
  windowMs: number = 24 * 60 * 60 * 1000, // default: 24h
): Promise<BurnRateResult> {
  const now = new Date();
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - windowMs);

  // Query error count for the period
  const errorCount = await repository.queryErrorCount({
    orgId,
    projectId,
    from: periodStart.toISOString(),
    to: periodEnd.toISOString(),
  });

  const result = calculateBurnRate(
    errorCount,
    sloTarget,
    periodStart,
    periodEnd,
    sloTarget,
  );

  return result;
}
