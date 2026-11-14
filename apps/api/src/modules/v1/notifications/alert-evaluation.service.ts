import { Injectable, Logger } from "@nestjs/common";
import { MetricsRepository } from "../../../modules/v1/metrics/metrics.repository";
import { NotificationService } from "./notification.service";
import { IncidentsService } from "../incidents/incidents.service";
import { MaintenanceWindowsService } from "../maintenance-windows/maintenance-windows.service";
import { db } from "../../../common/db";
import { alertTriggers, alertRules } from "../../../common/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { AlertRuleEngineService } from "./alert-engine/alert-rule-engine.service";
import { DedupService } from "./dedup/dedup.service";
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

import {
  decideAlertEvaluationRoute,
  type AlertEvaluationRoute,
} from "./alert-evaluation-fsm";

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

type AlertEvaluationRouteContext = {
  orgId: string;
  projectId: string;
  rule: AlertRuleRow;
  condition: AlertCondition;
  metricData: Record<string, unknown>;
  now: Date;
  metricValue: unknown;
  threshold: number | string | undefined;
};

@Injectable()
export class AlertEvaluationService {
  private readonly logger = new Logger(AlertEvaluationService.name);

  constructor(
    private readonly metricsRepository: MetricsRepository,
    private readonly notificationService: NotificationService,
    private readonly alertRuleEngine: AlertRuleEngineService,
    private readonly incidentsService: IncidentsService,
    private readonly maintenanceWindowsService: MaintenanceWindowsService,
    private readonly dedupService: DedupService,
  ) {}

  async evaluateProjectRules(orgId: string, projectId: string): Promise<void> {
    const rules = await db
      .select()
      .from(alertRules)
      .where(
        and(
          eq(alertRules.orgId, orgId),
          or(eq(alertRules.projectId, projectId), isNull(alertRules.projectId)),
          eq(alertRules.status, "active"),
        ),
      );

    if (!rules.length) return;

    const now = new Date();
    const from = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

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

        await this.incidentsService.checkForRecovery(ruleRow.id, metricData);

        const route = await this.decideRoute(
          orgId,
          projectId,
          ruleRow,
          condition,
          result,
          metricData,
          now,
        );

        await this.executeAlertEvaluationRoute(route, {
          orgId,
          projectId,
          rule: ruleRow,
          condition,
          metricData,
          now,
          metricValue: result.details.metricValue,
          threshold: condition.value,
        });
      }
    }
  }

  private async decideRoute(
    orgId: string,
    projectId: string,
    rule: AlertRuleRow,
    condition: AlertCondition,
    result: { result: string },
    metricData: Record<string, unknown>,
    now: Date,
  ): Promise<AlertEvaluationRoute> {
    const hasNoData = !metricData || Object.keys(metricData).length === 0;
    const satisfied = result.result === "satisfied";

    let isDedupe = false;
    let isSuppressed = false;
    let hasIncidentProtection = false;

    if (!hasNoData && satisfied) {
      const dedupResult = await this.dedupService.shouldDedupe(
        orgId,
        projectId,
        rule.id,
        now,
        rule.name,
      );
      isDedupe = dedupResult.isDedupe;

      isSuppressed = await this.maintenanceWindowsService.isAlertSuppressed(
        orgId,
        projectId,
        rule.id,
        undefined,
      );

      hasIncidentProtection =
        await this.dedupService.hasActiveIncidentProtection(rule.id);
    }

    return decideAlertEvaluationRoute({
      hasNoData,
      satisfied: !hasNoData && satisfied,
      isDedupe,
      isSuppressed,
      hasIncidentProtection,
    });
  }

  private async executeAlertEvaluationRoute(
    route: AlertEvaluationRoute,
    ctx: AlertEvaluationRouteContext,
  ): Promise<void> {
    switch (route) {
      case "no_data":
        await this.handleNoDataRoute(ctx);
        return;
      case "deduped":
        await this.handleDedupedRoute(ctx);
        return;
      case "suppressed":
        this.logger.log(
          `Alert ${ctx.rule.id} suppressed by maintenance window`,
        );
        return;
      case "protection_waiting":
        this.logger.log(
          `Alert ${ctx.rule.id} condition satisfied, waiting for incident protection (streak < 2)`,
        );
        return;
      case "dispatched":
        await this.handleDispatchedRoute(ctx);
        return;
      case "healthy_reset":
        await this.handleHealthyResetRoute(ctx);
        return;
    }
  }

  private async handleNoDataRoute(ctx: AlertEvaluationRouteContext) {
    const activeTrigger = await this.getActiveTriggerForRule(ctx.rule.id);
    if (activeTrigger) {
      await this.dedupService.transitionToNoData(activeTrigger.id, {
        mode: "alerting",
        thresholdMinutes: 5,
      });
    }
  }

  private async handleDedupedRoute(ctx: AlertEvaluationRouteContext) {
    const [existingTrigger] = await db
      .select({
        id: alertTriggers.id,
        streakCount: alertTriggers.streakCount,
      })
      .from(alertTriggers)
      .where(
        and(
          eq(alertTriggers.alertRuleId, ctx.rule.id),
          eq(alertTriggers.status, "active"),
        ),
      )
      .limit(1);

    if (existingTrigger) {
      await this.dedupService.updateStreak(existingTrigger.id, true);
      await this.dedupService.updateAlertState(
        existingTrigger.id,
        "firing",
        "Condition satisfied (deduped)",
      );
    }
    this.logger.log(
      `Alert ${ctx.rule.id} deduped (streak: ${existingTrigger?.streakCount ?? 0})`,
    );
  }

  private async handleDispatchedRoute(ctx: AlertEvaluationRouteContext) {
    await this.dedupService.recordTrigger(
      ctx.orgId,
      ctx.projectId,
      ctx.rule.id,
      ctx.rule.name,
      ctx.now,
      ctx.rule.minSeverity,
      { metric: ctx.condition.metric, value: ctx.metricValue },
    );

    const incidentId = `alert-${ctx.rule.id}-${ctx.condition.metric}`;
    const title = `Alert: ${ctx.rule.name}`;
    const body = `Condition "${ctx.condition.description ?? ctx.condition.metric}" violated: ${ctx.condition.metric} is ${ctx.metricValue} (threshold: ${ctx.threshold})`;
    const metadata = {
      alertRuleId: ctx.rule.id,
      metric: ctx.condition.metric,
      value: String(ctx.metricValue),
      threshold: String(ctx.threshold),
      operator: ctx.condition.operator,
    };

    await this.incidentsService.createOrUpdateIncident({
      incidentId,
      orgId: ctx.orgId,
      projectId: ctx.projectId,
      alertRuleId: ctx.rule.id,
      severity: ctx.rule.minSeverity,
      title,
      body,
      metadata,
    });

    await this.notificationService.dispatchAlert({
      orgId: ctx.orgId,
      projectId: ctx.projectId,
      incidentId,
      severity: ctx.rule.minSeverity as AlertRuleSeverity,
      title,
      body,
      htmlBody: undefined,
      metadata,
    });
  }

  private async handleHealthyResetRoute(ctx: AlertEvaluationRouteContext) {
    const activeTrigger = await this.getActiveTriggerForRule(ctx.rule.id);
    if (activeTrigger) {
      await this.dedupService.updateStreak(activeTrigger.id, false);
      await this.dedupService.updateAlertState(
        activeTrigger.id,
        "healthy",
        "Condition no longer satisfied",
      );
      await this.dedupService.resolveTrigger(activeTrigger.id);
      await this.incidentsService.checkForRecovery(ctx.rule.id, ctx.metricData);
    }
  }

  private async getActiveTriggerForRule(alertRuleId: string) {
    const [activeTrigger] = await db
      .select({ id: alertTriggers.id })
      .from(alertTriggers)
      .where(
        and(
          eq(alertTriggers.alertRuleId, alertRuleId),
          eq(alertTriggers.status, "active"),
        ),
      )
      .limit(1);
    return activeTrigger;
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
