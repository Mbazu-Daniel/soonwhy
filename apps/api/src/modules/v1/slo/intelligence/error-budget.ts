/**
 * Error budget status and threshold management
 */
export interface ErrorBudgetStatus {
  /** Current error budget remaining (percentage) */
  budgetRemaining: number;
  /** Current error budget consumed (percentage) */
  budgetConsumed: number;
  /** Burn rate - how fast budget is being consumed */
  burnRate: number;
  /** SLO target error rate */
  sloTarget: number;
  /** Status classification */
  status: 'healthy' | 'caution' | 'critical';
  /** Burn rate thresholds */
  thresholds: {
    /** Burn rate that triggers "caution" status */
    caution: number;
    /** Burn rate that triggers "critical" status */
    critical: number;
  };
  /** Estimated time until budget exhaustion (hours) */
  estimatedTimeToExhaustion?: number;
}

/**
 * Update error budget status based on new measurements
 */
export function updateErrorBudgetStatus(
  previousStatus: ErrorBudgetStatus,
  newBurnRate: number,
  newBudgetConsumed: number,
  periodProgress: number // 0-1, how far through the measurement period we are
): ErrorBudgetStatus {
  const { caution = 2, critical = 3 } = previousStatus.thresholds;

  let status: 'healthy' | 'caution' | 'critical';
  if (newBurnRate >= critical) {
    status = 'critical';
  } else if (newBurnRate >= caution) {
    status = 'caution';
  } else {
    status = 'healthy';
  }

  // Adjust budget consumed based on burn rate and period progress
  // If burn rate is higher than 1, we're consuming faster than allocated
  let budgetConsumed = newBudgetConsumed;
  if (newBurnRate > 1 && periodProgress > 0) {
    // Faster consumption = more budget used than linear proportion
    const acceleratedConsumption = newBurnRate * periodProgress;
    budgetConsumed = Math.min(100, acceleratedConsumption * 100);
  }

  // Estimate time to exhaustion
  let estimatedTimeToExhaustion: number | undefined;
  const budgetRemaining = 100 - budgetConsumed;
  if (newBurnRate > 0 && budgetRemaining > 0) {
    // At current burn rate, how long until budget is gone?
    // If burn rate = 2, we consume 2x the allocated budget per period
    const hoursInFullPeriod = 24; // assuming 24h periods
    const hoursElapsed = hoursInFullPeriod * periodProgress;
    const hoursRemainingInPeriod = hoursInFullPeriod * (1 - periodProgress);
    
    // Time to exhaustion at current rate
    const hoursToExhaustion = (budgetRemaining / newBurnRate) * (hoursInFullPeriod / 100);
    estimatedTimeToExhaustion = Math.max(0, hoursToExhaustion);
  }

  return {
    budgetRemaining: Math.round((100 - budgetConsumed) * 100) / 100,
    budgetConsumed: Math.round(budgetConsumed * 100) / 100,
    burnRate: Math.round(newBurnRate * 100) / 100,
    status,
    sloTarget: previousStatus.sloTarget,
    thresholds: previousStatus.thresholds,
    estimatedTimeToExhaustion: estimatedTimeToExhaustion 
      ? Math.round(estimatedTimeToExhaustion * 100) / 100 
      : undefined,
  };
}