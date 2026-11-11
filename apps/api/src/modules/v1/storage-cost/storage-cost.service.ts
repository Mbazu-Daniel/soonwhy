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

  // Cost per GB per month (adjust based on actual storage provider)
  private readonly costPerGBPerMonth = 0.023; // $0.023/GB/month (approximate S3 pricing)

  async getStorageCosts(orgId: string, projectId: string): Promise<StorageCostData> {
    // Get retention policies for the project
    const policies = await db
      .select()
      .from(retentionPolicies)
      .where(
        and(
          eq(retentionPolicies.orgId, orgId),
          eq(retentionPolicies.projectId, projectId),
        ),
      );

    // Estimate storage size based on retention periods
    // In production, this would query actual storage usage from Quickwit
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
    // Find policy for this data type
    const policy = policies.find((p) => p.dataType === dataType);
    if (!policy) {
      // Default to 30 days retention if no policy
      return this.calculateEstimatedSize(30);
    }

    return this.calculateEstimatedSize(policy.retentionDays);
  }

  private calculateEstimatedSize(retentionDays: number): number {
    // Estimate: 100 MB per day of logs, 50 MB per day of traces, 10 MB per day of metrics
    // This is a rough estimate - production should use actual storage metrics
    const dailySizeMB = 160; // Total across all data types
    return dailySizeMB * retentionDays;
  }

  async getCostRecommendations(orgId: string, projectId: string) {
    const costs = await this.getStorageCosts(orgId, projectId);
    const recommendations = [];

    if (costs.estimatedCost > 10) {
      recommendations.push({
        type: "high_cost",
        message: `Storage costs are high ($${costs.estimatedCost.toFixed(2)}/month). Consider reducing retention periods.`,
        potentialSavings: costs.estimatedCost * 0.3, // 30% potential savings
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
