import { Injectable, Logger } from "@nestjs/common";
import { SlosRepository } from "./slos.repository";
import { MetricsRepository } from "../metrics/metrics.repository";

@Injectable()
export class SlosService {
  private readonly logger = new Logger(SlosService.name);

  constructor(
    private readonly repository: SlosRepository,
    private readonly metricsRepository: MetricsRepository,
  ) {}

  async createSlo(data: {
    orgId: string;
    projectId: string;
    name: string;
    description?: string;
    serviceName: string;
    targetPercentage: number;
    period: string;
    measurementType: string;
    goodEventsThreshold?: number;
    windowSize?: number;
    alertOnBurnRate?: boolean;
    alertThresholds?: Record<string, unknown>;
  }) {
    return this.repository.createSlo(data);
  }

  async getSlos(
    orgId: string,
    projectId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    return this.repository.getSlos(orgId, projectId, limit, offset);
  }

  async getSloById(id: number, orgId: string, projectId: string) {
    return this.repository.getSloById(id, orgId, projectId);
  }

  async updateSlo(
    id: number,
    data: {
      name?: string;
      description?: string;
      targetPercentage?: number;
      period?: string;
      measurementType?: string;
      goodEventsThreshold?: number;
      windowSize?: number;
      alertOnBurnRate?: boolean;
      alertThresholds?: Record<string, unknown>;
      isActive?: boolean;
    },
  ) {
    return this.repository.updateSlo(id, data);
  }

  async deleteSlo(id: number) {
    await this.repository.deleteSlo(id);
  }

  async calculateSloCompliance(sloId: number, orgId: string, projectId: string) {
    const slo = await this.repository.getSloById(sloId, orgId, projectId);
    if (!slo) {
      throw new Error("SLO not found");
    }

    const now = new Date();
    const windowStart = new Date(
      now.getTime() - (slo.windowSize || 30) * 24 * 60 * 60 * 1000,
    );

    let goodEvents = 0;
    let totalEvents = 0;

    // Fetch metrics based on measurement type
    if (slo.measurementType === "availability" || slo.measurementType === "error_rate") {
      try {
        const buckets = await this.metricsRepository.queryMetrics({
          orgId: slo.orgId,
          projectId: slo.projectId,
          from: windowStart.toISOString(),
          to: now.toISOString(),
          interval: "1d",
          service: slo.serviceName,
        });

        for (const bucket of buckets) {
          const total = (bucket._2xx || 0) + (bucket._3xx || 0) + (bucket._4xx || 0) + (bucket._5xx || 0);
          const good = (bucket._2xx || 0) + (bucket._3xx || 0); // 2xx and 3xx are "good"
          
          totalEvents += total;
          goodEvents += good;
        }
      } catch (error) {
        this.logger.error(`Failed to fetch metrics for SLO ${sloId}`, error);
      }
    } else if (slo.measurementType === "latency") {
      try {
        const buckets = await this.metricsRepository.queryMetrics({
          orgId: slo.orgId,
          projectId: slo.projectId,
          from: windowStart.toISOString(),
          to: now.toISOString(),
          interval: "1d",
          service: slo.serviceName,
        });

        const threshold = slo.goodEventsThreshold || 1000; // Default 1s

        for (const bucket of buckets) {
          totalEvents += bucket.count || 0;
          // Count requests below threshold as "good"
          if (bucket.p50 && bucket.p50 < threshold) {
            goodEvents += bucket.count || 0;
          }
        }
      } catch (error) {
        this.logger.error(`Failed to fetch metrics for SLO ${sloId}`, error);
      }
    }

    if (totalEvents === 0) {
      return {
        sloId,
        compliance: 100,
        errorBudgetRemaining: 100,
        errorBudgetBurnRate: "none",
        goodEvents: 0,
        totalEvents: 0,
      };
    }

    const compliance = Math.round((goodEvents / totalEvents) * 100);
    const errorBudgetRemaining = compliance - (100 - slo.targetPercentage);
    const errorBudgetBurnRate = this.calculateBurnRate(errorBudgetRemaining, slo.targetPercentage);

    // Update SLO with current compliance
    await this.repository.updateSloCompliance(sloId, {
      currentCompliance: compliance,
      errorBudgetRemaining,
      errorBudgetBurnRate,
    });

    // Create snapshot
    await this.repository.createComplianceSnapshot({
      sloId,
      compliance,
      errorBudgetRemaining,
      goodEvents,
      totalEvents,
      windowStart,
      windowEnd: now,
    });

    return {
      sloId,
      compliance,
      errorBudgetRemaining,
      errorBudgetBurnRate,
      goodEvents,
      totalEvents,
    };
  }

  private calculateBurnRate(
    errorBudgetRemaining: number,
    targetPercentage: number,
  ): string {
    const errorBudgetUsed = 100 - errorBudgetRemaining;
    const totalErrorBudget = 100 - targetPercentage;
    const burnRate = (errorBudgetUsed / totalErrorBudget) * 100;

    if (burnRate > 75) return "critical";
    if (burnRate > 50) return "fast";
    if (burnRate > 25) return "slow";
    return "none";
  }

  async getComplianceSnapshots(sloId: number, orgId: string, projectId: string, limit: number = 100) {
    return this.repository.getComplianceSnapshots(sloId, orgId, projectId, limit);
  }

  async getRecentSnapshotsForAllSlos(
    orgId: string,
    projectId: string,
    hoursAgo: number = 24,
  ) {
    return this.repository.getRecentSnapshotsForAllSlos(orgId, projectId, hoursAgo);
  }
}
