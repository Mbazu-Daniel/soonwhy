import { Injectable, Logger } from "@nestjs/common";
import { MetricsRepository } from "../metrics/metrics.repository";
import { DeploymentsRepository } from "../deployments/deployments.repository";

interface TimeComparisonResult {
  current: {
    period: string;
    metrics: {
      totalRequests: number;
      errorRate: number;
      p50: number;
      p95: number;
      p99: number;
    };
  };
  previous: {
    period: string;
    metrics: {
      totalRequests: number;
      errorRate: number;
      p50: number;
      p95: number;
      p99: number;
    };
  };
  change: {
    requestsChange: number;
    requestsChangePercent: number;
    errorRateChange: number;
    errorRateChangePercent: number;
    p50Change: number;
    p50ChangePercent: number;
    p95Change: number;
    p95ChangePercent: number;
    p99Change: number;
    p99ChangePercent: number;
  };
}

@Injectable()
export class HistoricalAnalysisService {
  private readonly logger = new Logger(HistoricalAnalysisService.name);

  constructor(
    private readonly metricsRepository: MetricsRepository,
    private readonly deploymentsRepository: DeploymentsRepository,
  ) {}

  async compareTimePeriods(
    orgId: string,
    projectId: string,
    service: string,
    currentFrom: string,
    currentTo: string,
    previousFrom: string,
    previousTo: string,
  ): Promise<TimeComparisonResult> {
    try {
      const [currentMetrics, previousMetrics] = await Promise.all([
        this.getMetricsForPeriod(orgId, projectId, service, currentFrom, currentTo),
        this.getMetricsForPeriod(orgId, projectId, service, previousFrom, previousTo),
      ]);

      const change = this.calculateChange(currentMetrics, previousMetrics);

      return {
        current: {
          period: `${currentFrom} to ${currentTo}`,
          metrics: currentMetrics,
        },
        previous: {
          period: `${previousFrom} to ${previousTo}`,
          metrics: previousMetrics,
        },
        change,
      };
    } catch (error) {
      this.logger.error("Failed to compare time periods", error);
      throw error;
    }
  }

  async getTrendAnalysis(
    orgId: string,
    projectId: string,
    service: string,
    daysBack: number = 30,
    interval: string = "1d",
  ) {
    const now = new Date();
    const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    const buckets = await this.metricsRepository.queryMetrics({
      orgId,
      projectId,
      from: from.toISOString(),
      to: now.toISOString(),
      interval,
      service,
    });

    return buckets.map((bucket) => ({
      timestamp: bucket.bucket,
      date: new Date(bucket.bucket).toISOString().split('T')[0],
      totalRequests: bucket.count || 0,
      errorRate: bucket.count ? ((bucket._4xx || 0) + (bucket._5xx || 0)) / bucket.count * 100 : 0,
      p50: bucket.p50 || 0,
      p95: bucket.p95 || 0,
      p99: bucket.p99 || 0,
    }));
  }

  async compareDeployments(
    orgId: string,
    projectId: string,
    service: string,
    beforeDeploymentId: string,
    afterDeploymentId: string,
    windowMinutes: number = 60,
  ) {
    // Get deployment timestamps
    const beforeDeployment = await this.getDeploymentTimestamp(beforeDeploymentId);
    const afterDeployment = await this.getDeploymentTimestamp(afterDeploymentId);

    if (!beforeDeployment || !afterDeployment) {
      throw new Error("Deployment not found");
    }

    // Calculate time windows
    const beforeWindowStart = new Date(beforeDeployment.getTime() - windowMinutes * 60 * 1000);
    const beforeWindowEnd = new Date(beforeDeployment.getTime() - 5 * 60 * 1000); // 5 min buffer

    const afterWindowStart = new Date(afterDeployment.getTime() + 5 * 60 * 1000); // 5 min buffer
    const afterWindowEnd = new Date(afterDeployment.getTime() + windowMinutes * 60 * 1000);

    // Get metrics for both windows
    const [beforeMetrics, afterMetrics] = await Promise.all([
      this.getMetricsForPeriod(
        orgId,
        projectId,
        service,
        beforeWindowStart.toISOString(),
        beforeWindowEnd.toISOString(),
      ),
      this.getMetricsForPeriod(
        orgId,
        projectId,
        service,
        afterWindowStart.toISOString(),
        afterWindowEnd.toISOString(),
      ),
    ]);

    const change = this.calculateChange(afterMetrics, beforeMetrics);

    return {
      before: {
        deploymentId: beforeDeploymentId,
        period: `${beforeWindowStart.toISOString()} to ${beforeWindowEnd.toISOString()}`,
        metrics: beforeMetrics,
      },
      after: {
        deploymentId: afterDeploymentId,
        period: `${afterWindowStart.toISOString()} to ${afterWindowEnd.toISOString()}`,
        metrics: afterMetrics,
      },
      change,
      regressionDetected: change.errorRateChangePercent > 20 || change.p95ChangePercent > 50,
    };
  }

  private async getDeploymentTimestamp(deploymentId: string): Promise<Date | null> {
    try {
      const deployment = await this.deploymentsRepository.getById(deploymentId);
      if (deployment && deployment.deployedAt) {
        return new Date(deployment.deployedAt);
      }
      return null;
    } catch (error) {
      this.logger.error(`Failed to get deployment timestamp for ${deploymentId}`, error);
      return null;
    }
  }

  private async getMetricsForPeriod(
    orgId: string,
    projectId: string,
    service: string,
    from: string,
    to: string,
  ) {
    const buckets = await this.metricsRepository.queryMetrics({
      orgId,
      projectId,
      from,
      to,
      interval: "1d",
      service,
    });

    let totalRequests = 0;
    let totalErrors = 0;
    let p50Sum = 0;
    let p95Sum = 0;
    let p99Sum = 0;
    let count = 0;

    for (const bucket of buckets) {
      totalRequests += bucket.count || 0;
      totalErrors += (bucket._4xx || 0) + (bucket._5xx || 0);
      
      if (bucket.p50) {
        p50Sum += bucket.p50;
        count++;
      }
      if (bucket.p95) {
        p95Sum += bucket.p95;
      }
      if (bucket.p99) {
        p99Sum += bucket.p99;
      }
    }

    return {
      totalRequests,
      errorRate: totalRequests ? (totalErrors / totalRequests) * 100 : 0,
      p50: count ? p50Sum / count : 0,
      p95: count ? p95Sum / count : 0,
      p99: count ? p99Sum / count : 0,
    };
  }

  private calculateChange(current: any, previous: any) {
    const calculatePercentChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      requestsChange: current.totalRequests - previous.totalRequests,
      requestsChangePercent: calculatePercentChange(current.totalRequests, previous.totalRequests),
      errorRateChange: current.errorRate - previous.errorRate,
      errorRateChangePercent: calculatePercentChange(current.errorRate, previous.errorRate),
      p50Change: current.p50 - previous.p50,
      p50ChangePercent: calculatePercentChange(current.p50, previous.p50),
      p95Change: current.p95 - previous.p95,
      p95ChangePercent: calculatePercentChange(current.p95, previous.p95),
      p99Change: current.p99 - previous.p99,
      p99ChangePercent: calculatePercentChange(current.p99, previous.p99),
    };
  }
}
