import { Injectable, Logger } from "@nestjs/common";
import { retentionPolicies } from "../../../common/db/schema";
import { db } from "../../../common/db";
import { eq, and, desc } from "drizzle-orm";

interface StorageCostData {
  orgId: string;
  projectId: string;
  totalSizeMB: number;
  estimatedCost: number;
  logsSizeMB: number;
  tracesSizeMB: number;
  metricsSizeMB: number;
}

@Injectable()
export class StorageCostMonitoringService {
  private readonly logger = new Logger(StorageCostMonitoringService.name);

  private readonly costPerGBPerMonth = 0.023;

  async getStorageCosts(orgId: string, projectId: string): Promise<StorageCostData> {
    const policies = await db
      .select()
      .from(retentionPolicies)
      .where(
        and(
          eq(retentionPolicies.orgId, orgId),
          eq(retentionPolicies.projectId, projectId),
        ),
      );

    const logsSizeMB = this.estimateSize(policies, "logs");
    const tracesSizeMB = this.estimateSize(policies, "traces");
    const metricsSizeMB = this.estimateSize(policies, "metrics");

    const totalSizeMB = logsSizeMB + tracesSizeMB + metricsSizeMB;
    const totalSizeGB = totalSizeMB / 1024;
    const estimatedCost = totalSizeGB * this.costPerGBPerMonth;

    return {
      orgId,
      projectId,
      totalSizeMB,
      estimatedCost,
      logsSizeMB,
      tracesSizeMB,
      metricsSizeMB,
    };
  }

  private estimateSize(policies: any[], dataType: string): number {
    const policy = policies.find((p) => p.dataType === dataType);
    if (!policy) {
      return this.calculateEstimatedSize(30);
    }

    return this.calculateEstimatedSize(policy.retentionDays);
  }

  private calculateEstimatedSize(retentionDays: number): number {
    const dailySizeMB = 160;
    return dailySizeMB * retentionDays;
  }

  async getCostRecommendations(orgId: string, projectId: string) {
    const costs = await this.getStorageCosts(orgId, projectId);
    const recommendations = [];

    if (costs.estimatedCost > 10) {
      recommendations.push({
        type: "high_cost",
        message: `Storage costs are high ($${costs.estimatedCost.toFixed(2)}/month). Consider reducing retention periods.`,
        potentialSavings: costs.estimatedCost * 0.3,
      });
    }

    if (costs.logsSizeMB > costs.tracesSizeMB * 2) {
      recommendations.push({
        type: "optimize_logs",
        message: "Logs storage is significantly larger than traces. Consider log sampling or reducing log retention.",
        potentialSavings: costs.logsSizeMB * 0.4 * this.costPerGBPerMonth / 1024,
      });
    }

    if (costs.metricsSizeMB > costs.tracesSizeMB) {
      recommendations.push({
        type: "optimize_metrics",
        message: "Metrics storage is larger than traces. Consider increasing metric aggregation intervals.",
        potentialSavings: costs.metricsSizeMB * 0.2 * this.costPerGBPerMonth / 1024,
      });
    }

    return {
      costs,
      recommendations,
    };
  }
}
