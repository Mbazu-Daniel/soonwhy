import { Injectable, Logger } from "@nestjs/common";
import { atMetricPath, hostSampleValues, metricValues } from "./alert-metric-values";
import { HOST_SAMPLE_COUNT_METRIC } from "../domain/alert-metric-values.constants";
import { MetricsRepository } from "../../telemetry/metrics/infrastructure/metrics.repository";
import { NotificationService } from "./notification.service";
import { IncidentsService } from "../../detection/incidents/application/incidents.service";
import { MaintenanceWindowsService } from "../../detection/maintenance-windows/application/maintenance-windows.service";
import { db } from "../../../../common/db";
import { alertRules } from "../../../../common/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { AlertRuleEngineService } from "../alert-engine/alert-rule-engine.service";
import { alertFinding, raiseFinding, resolveAlertFinding } from "../../detection/findings";
import { DedupService } from "../dedup/dedup.service";
import { loadAlertContext } from "./alert-context";
import { buildAlertMessage } from "../domain/alert-message";
import { MAX_FAILING_ROUTES } from "../domain/alert-message.constants";
import type { AlertRuleSeverity } from "../../../../common/db/schema";

interface AlertRuleRow {
  id: string;
  orgId: string;
  projectId: string;
  name: string;
  conditions: unknown[];
  minSeverity: string;
  channelIds: string[];
  dedupeWindowSeconds: number;
  findingCategory?: "error" | "performance" | "security" | "vulnerability" | null;
}

import { decideAlertEvaluationRoute } from "../domain/alert-evaluation-fsm";
import { type AlertEvaluationRoute } from "../domain/alert-evaluation-fsm.types";

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

        await this.incidentsService.checkForRecovery({ orgId, projectId }, ruleRow.id, metricData);

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
      ({ isDedupe, hasIncidentProtection } = await this.dedupService.assess(orgId, projectId, rule, now));
      isSuppressed = await this.maintenanceWindowsService.isAlertSuppressed(orgId, projectId, rule.id, undefined);
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
    await this.dedupService.markNoData(ctx.rule.id, { mode: "alerting", thresholdMinutes: 5 });
  }

  private async handleDedupedRoute(ctx: AlertEvaluationRouteContext) {
    const streak = await this.dedupService.markFiring(ctx.rule.id);
    await this.flagFinding(ctx);
    this.logger.log(`Alert ${ctx.rule.id} deduped (streak: ${streak})`);
  }

  private async flagFinding(ctx: AlertEvaluationRouteContext) {
    try {
      await raiseFinding(
        alertFinding({
          orgId: ctx.orgId,
          projectId: ctx.projectId,
          ruleId: ctx.rule.id,
          ruleName: ctx.rule.name,
          ruleSeverity: ctx.rule.minSeverity,
          metric: ctx.condition.metric,
          operator: ctx.condition.operator,
          description: ctx.condition.description,
          value: ctx.metricValue,
          threshold: ctx.threshold,
          at: ctx.now,
          category: ctx.rule.findingCategory,
        }),
        ctx.now,
      );
    } catch (error) {
      this.logger.warn(`Could not flag alert ${ctx.rule.id} as a finding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async resolveFinding(ctx: AlertEvaluationRouteContext) {
    try {
      await resolveAlertFinding(ctx.projectId, ctx.rule.id, ctx.now);
    } catch (error) {
      this.logger.warn(`Could not resolve the finding for alert ${ctx.rule.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleDispatchedRoute(ctx: AlertEvaluationRouteContext) {
    await this.dedupService.markDispatched(ctx.rule.id, ctx.now, ctx.rule.minSeverity, {
      metric: ctx.condition.metric,
      value: ctx.metricValue,
    });

    await this.flagFinding(ctx);

    const incidentId = `alert-${ctx.rule.id}-${ctx.condition.metric}`;
    const message = await this.messageFor(ctx);
    const { title, body, htmlBody } = message;
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
      htmlBody,
      metadata,
    });
  }

  private async messageFor(ctx: AlertEvaluationRouteContext) {
    const context = await loadAlertContext(ctx.projectId).catch(() => ({}) as Awaited<ReturnType<typeof loadAlertContext>>);
    const failingRoutes = await this.metricsRepository
      .queryTopFailingRoutes(
        { orgId: ctx.orgId, projectId: ctx.projectId, from: new Date(ctx.now.getTime() - 5 * 60 * 1000).toISOString(), to: ctx.now.toISOString() },
        MAX_FAILING_ROUTES,
      )
      .catch(() => []);
    return buildAlertMessage({
      ruleName: ctx.rule.name,
      severity: ctx.rule.minSeverity,
      metric: ctx.condition.metric,
      operator: ctx.condition.operator,
      description: ctx.condition.description,
      value: ctx.metricValue,
      threshold: ctx.threshold,
      window: ctx.condition.window,
      firedAt: ctx.now,
      projectName: context.projectName,
      findingUrl: context.findingUrl,
      failingRoutes,
    });
  }

  private async handleHealthyResetRoute(ctx: AlertEvaluationRouteContext) {
    if (!(await this.dedupService.recover(ctx.rule.id))) return;
    await this.resolveFinding(ctx);
    await this.incidentsService.checkForRecovery({ orgId: ctx.orgId, projectId: ctx.projectId }, ctx.rule.id, ctx.metricData);
  }

  private async fetchMetricData(
    orgId: string,
    projectId: string,
    metric: string,
    from: string,
    to: string,
  ): Promise<Record<string, unknown>> {
    try {
      if (metric === HOST_SAMPLE_COUNT_METRIC) {
        return atMetricPath(metric, hostSampleValues(await this.metricsRepository.countHostSamples({ orgId, projectId, from, to })));
      }
      const buckets = await this.metricsRepository.queryMetrics({
        orgId,
        projectId,
        from,
        to,
        interval: "5m",
        service: "",
      });

      return atMetricPath(metric, metricValues(metric, buckets[buckets.length - 1]));
    } catch (error) {
      this.logger.error(
        `Failed to fetch metric data for ${metric}`,
        error instanceof Error ? error.message : String(error),
      );
      return {};
    }
  }
}
