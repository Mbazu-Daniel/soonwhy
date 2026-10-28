import { Injectable, Logger } from "@nestjs/common";
import { MetricsRepository } from "../../../modules/v1/metrics/metrics.repository";
import { NotificationService } from "./notification.service";
import { db } from "../../../common/db";
import { alertRules } from "../../../common/db/schema";
import { eq, and } from "drizzle-orm";
import { AlertRuleEngineService } from "./alert-engine/alert-rule-engine.service";
import type { AlertRuleSeverity } from "../../../common/db/schema";

interface AlertRuleRow {
  id: string;
  orgId: string;
  projectId: string;
  name: string;
  conditions: any[];
  minSeverity: string;
  channelIds: string[];
  dedupeWindowSeconds: number;
}

type AlertCondition = {
  type: string;
  metric: string;
  operator: string;
  value?: number | string;
  window?: string;
  aggregation?: string;
  negate?: boolean;
  description?: string;
};

@Injectable()
export class AlertEvaluationService {
  private readonly logger = new Logger(AlertEvaluationService.name);

  constructor(
    private readonly metricsRepository: MetricsRepository,
    private readonly notificationService: NotificationService,
    private readonly alertRuleEngine: AlertRuleEngineService,
  ) {}

  /**
   * Evaluate all active alert rules for a project against current metrics.
   * Dispatch alerts for any violated conditions.
   */
  async evaluateProjectRules(orgId: string, projectId: string): Promise<void> {
    const rules = await db
      .select()
      .from(alertRules)
      .where(
        and(
          eq(alertRules.orgId, orgId),
          eq(alertRules.projectId, projectId),
          eq(alertRules.status, "active"),
        ),
      );

    if (!rules.length) return;

    const now = new Date();
    const from = new Date(now.getTime() - 5 * 60 * 1000).toISOString(); // last 5 minutes

    for (const rule of rules) {
      const ruleRow = rule as unknown as AlertRuleRow;
      const conditions = (ruleRow.conditions ?? []) as AlertCondition[];

      for (const condition of conditions) {
        const metricData = await this.fetchMetricData(
          orgId,
          projectId,
          condition.metric,
          from,
          now.toISOString(),
        );

        const result = await this.alertRuleEngine.evaluateCondition(
          condition as Parameters<AlertRuleEngineService["evaluateCondition"]>[0],
          metricData,
          now,
        );

        if (result.result === "satisfied") {
          await this.notificationService.dispatchAlert({
            orgId,
            projectId,
            incidentId: `alert-${ruleRow.id}`,
            severity: ruleRow.minSeverity as AlertRuleSeverity,
            title: `Alert: ${ruleRow.name}`,
            body: `Condition "${condition.description ?? condition.metric}" violated: ${condition.metric} is ${result.details.metricValue} (threshold: ${condition.value})`,
            htmlBody: undefined,
            metadata: {
              alertRuleId: ruleRow.id,
              metric: condition.metric,
              value: String(result.details.metricValue),
              threshold: String(condition.value),
              operator: condition.operator,
            },
          });
        }
      }
    }
  }

  private async fetchMetricData(
    orgId: string,
    projectId: string,
    metric: string,
    from: string,
    to: string,
  ): Promise<Record<string, unknown>> {
    try {
      const buckets = await this.metricsRepository.queryMetrics({
        orgId,
        projectId,
        from,
        to,
        interval: "5m",
        service: "",
      });

      const data: Record<string, unknown> = {};

      const latest = buckets[buckets.length - 1];
      if (!latest) return data;

      // Map metric names to bucket fields
      switch (metric) {
        case "http.server.request.duration.p95":
          data.value = latest.p95;
          data.p95 = latest.p95;
          break;
        case "http.server.request.duration.p50":
          data.value = latest.p50;
          data.p50 = latest.p50;
          break;
        case "http.server.request.duration.p99":
          data.value = latest.p99;
          data.p99 = latest.p99;
          break;
        case "http.server.request.errors.rate":
          const total =
            (latest._2xx ?? 0) +
            (latest._3xx ?? 0) +
            (latest._4xx ?? 0) +
            (latest._5xx ?? 0);
          const errors = (latest._4xx ?? 0) + (latest._5xx ?? 0);
          data.value = total ? (errors / total) * 100 : 0;
          data.errorRate = data.value;
          break;
        case "http.server.request.count":
          data.value = latest.count;
          data.requestCount = latest.count;
          break;
        default:
          data.value = latest.p95;
      }

      return data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch metric data for ${metric}`,
        error instanceof Error ? error.message : String(error),
      );
      return {};
    }
  }
}
