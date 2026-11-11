import { Injectable, Logger } from "@nestjs/common";
import { db } from "../../../common/db";
import { alertRules, type AlertRuleSeverity } from "../../../common/db/schema";
import { eq } from "drizzle-orm";

@Injectable()
export class SelfMonitoringService {
  private readonly logger = new Logger(SelfMonitoringService.name);

  async ensureSelfMonitoringAlerts() {
    const orgId = "soonwhy-internal";
    const projectId = "platform";

    try {
      // Check if self-monitoring alerts exist
      const existing = await db
        .select()
        .from(alertRules)
        .where(eq(alertRules.orgId, orgId));

      if (existing.length > 0) {
        this.logger.log("Self-monitoring alerts already exist");
        return;
      }

      // Create self-monitoring alert rules
      const alerts = [
        {
          id: `self-pipeline-lag-${Date.now()}`,
          orgId,
          projectId,
          name: "Pipeline Lag High",
          description: "Alert when Quickwit indexing lag exceeds 60 seconds",
          minSeverity: "medium" as AlertRuleSeverity,
          channelIds: [],
          status: "active" as const,
          dedupeWindowSeconds: 300,
          conditions: [
            {
              type: "metric",
              metric: "quickwitIndexingLagMs",
              operator: ">",
              threshold: 60000,
              windowMinutes: 5,
            },
          ],
        },
        {
          id: `self-dlq-rate-${Date.now()}`,
          orgId,
          projectId,
          name: "DLQ High Error Rate",
          description: "Alert when DLQ rate exceeds 5% of accepted events",
          minSeverity: "high" as AlertRuleSeverity,
          channelIds: [],
          status: "active" as const,
          dedupeWindowSeconds: 300,
          conditions: [
            {
              type: "metric",
              metric: "dlqRate",
              operator: ">",
              threshold: 0.05,
              windowMinutes: 5,
            },
          ],
        },
        {
          id: `self-ingest-health-${Date.now()}`,
          orgId,
          projectId,
          name: "Ingest Worker Unhealthy",
          description: "Alert when ingest worker health check fails",
          minSeverity: "critical" as AlertRuleSeverity,
          channelIds: [],
          status: "active" as const,
          dedupeWindowSeconds: 60,
          conditions: [
            {
              type: "metric",
              metric: "ingestHealthy",
              operator: "==",
              threshold: 0,
              windowMinutes: 1,
            },
          ],
        },
      ];

      for (const alert of alerts) {
        await db.insert(alertRules).values(alert);
      }

      this.logger.log(`Created ${alerts.length} self-monitoring alert rules`);
    } catch (error) {
      this.logger.warn(
        `Failed to create self-monitoring alerts (organization may not exist): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
