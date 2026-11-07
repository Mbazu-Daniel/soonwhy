import { Injectable } from '@nestjs/common';
import { MetricsRepository } from './metrics.repository';
import { GetSLOInput, SLOMetrics, SLOWindow } from './dto';
import { getBurnRateFromRepository, calculateBurnRate, ErrorBudgetStatus, updateErrorBudgetStatus } from './intelligence/burn-rate-calculation';
import { QueryErrorCountInput } from '../metrics/dto';

@Injectable()
export class SLOService {
  private readonly defaultSLOTarget = 0.99; // 99% by default
  private readonly cautionBurnRate = 2; // burn rate >= 2 triggers caution
  private readonly criticalBurnRate = 3; // burn rate >= 3 triggers critical

  constructor(private readonly metricsRepository: MetricsRepository) {}

  private getWindowMs(window: string): number {
    const windowMs: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    };
    return windowMs[window] ?? windowMs['24h'] ?? 24 * 60 * 60 * 1000;
  }

  private getSLOTarget(sloId: string): number {
    return this.defaultSLOTarget;
  }

  async getSLOMetrics(
    orgId: string,
    projectId: string,
    input: GetSLOInput
  ): Promise<SLOMetrics> {
    const {
      sloId,
      from,
      to,
      window = '24h',
    } = input;

    // Determine measurement window
    const now = new Date();
    const toDate = to ?? now;
    const fromDate = from ?? new Date(toDate.getTime() - this.getWindowMs(window));

    // Get error count and total count from metrics repository
    const [errorCount, totalCount] = await Promise.all([
      this.queryErrorCount(orgId, projectId, fromDate, toDate),
      this.queryTotalCount(orgId, projectId, fromDate, toDate),
    ]);

    const actualErrorRate = totalCount > 0 ? errorCount / totalCount : 0;
    const sloTarget = sloId ? this.getSLOTarget(sloId) : this.defaultSLOTarget;

    // Calculate burn rate using the calculated rates
    const burnRateResult = calculateBurnRate(
      errorCount,
      sloTarget,
      fromDate,
      toDate,
      sloTarget
    );

    // Get or create status
    const previousStatus: ErrorBudgetStatus = {
      budgetRemaining: 100,
      budgetConsumed: 0,
      burnRate: 0,
      sloTarget,
      status: 'healthy',
      thresholds: { caution: this.cautionBurnRate, critical: this.criticalBurnRate },
    };

    const updatedStatus = updateErrorBudgetStatus(
      previousStatus,
      burnRateResult.burnRate,
      burnRateResult.percentageOfBudgetConsumed,
      0 // periodProgress will be calculated below
    );

    // Calculate period progress
    const periodMs = toDate.getTime() - fromDate.getTime();
    const elapsedMs = now.getTime() - fromDate.getTime();
    const periodProgress = elapsedMs / periodMs || 0;

    // Re-update with correct period progress
    const finalStatus = updateErrorBudgetStatus(
      previousStatus,
      burnRateResult.burnRate,
      burnRateResult.percentageOfBudgetConsumed,
      periodProgress
    );

    // Calculate budget metrics
    const budgetRemaining = finalStatus.budgetRemaining;
    const budgetConsumed = finalStatus.budgetConsumed;

    return {
      target: sloTarget,
      current: actualErrorRate,
      budgetRemaining,
      budgetConsumed,
      burnRate: finalStatus.burnRate,
      status: finalStatus.status,
      estimatedTimeToExhaustion: finalStatus.estimatedTimeToExhaustion,
      lastUpdated: now,
    };
  }

  private async queryErrorCount(
  orgId: string,
  projectId: string,
  from: Date,
  to: Date
): Promise<number> {
  try {
    const buckets = await this.metricsRepository.queryMetrics({
      orgId,
      projectId,
      from: from.toISOString(),
      to: to.toISOString(),
      interval: '1h',
      service: '',
    });
    // Sum up 5xx errors as error count
    let errorCount = 0;
    for (const bucket of buckets) {
      errorCount += bucket._5xx ?? 0;
    }
    return errorCount;
  } catch (error) {
    console.error('Error querying error count:', error);
    return 0;
  }
}

private async queryTotalCount(
  orgId: string,
  projectId: string,
  from: Date,
  to: Date
): Promise<number> {
  try {
    const buckets = await this.metricsRepository.queryMetrics({
      orgId,
      projectId,
      from: from.toISOString(),
      to: to.toISOString(),
      interval: '1h',
      service: '',
    });
    // Sum up all 2xx+3xx+4xx+5xx as total requests
    let totalCount = 0;
    for (const bucket of buckets) {
      totalCount += (bucket._2xx ?? 0) + (bucket._3xx ?? 0) + (bucket._4xx ?? 0) + (bucket._5xx ?? 0);
    }
    return totalCount;
  } catch (error) {
    console.error('Error querying total count:', error);
    return 0;
  }
}
}
