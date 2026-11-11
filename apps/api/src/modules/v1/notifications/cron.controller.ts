import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { WeeklySummaryService } from "@soonwhy/shared";
import { AlertEvaluationService } from "./alert-evaluation.service";
import { InternalCronGuard } from "../../../common/guards/internal-cron.guard";
import { maskPii } from "../../../common/privacy/pii-masker";
import {
  WeeklySummaryRequestSchema,
  type WeeklySummaryRequestInput,
} from "./dto/weekly-summary-request.dto";
import { db } from "../../../common/db";
import { alertRules } from "../../../common/db/schema";
import { eq } from "drizzle-orm";
import { SyntheticProbesRepository } from "../synthetic-probes/synthetic-probes.repository";

@UseGuards(InternalCronGuard)
@Controller("notifications/cron")
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(
    private readonly service: WeeklySummaryService,
    private readonly alertEvaluation: AlertEvaluationService,
    private readonly syntheticProbes: SyntheticProbesRepository,
  ) {}

  @Post("weekly-summary")
  async weeklySummary(
    @Body({ schema: WeeklySummaryRequestSchema })
    body: WeeklySummaryRequestInput,
  ) {
    return this.service.dispatchWeeklySummary(body);
  }

  @Post("evaluate-alerts")
  async evaluateAlerts(
    @Query("projectId") projectId?: string,
    @Query("orgId") orgId?: string,
  ) {
    if (!projectId || !orgId) {
      throw new BadRequestException("projectId and orgId are required");
    }
    await this.alertEvaluation.evaluateProjectRules(orgId, projectId);
    return { evaluated: true, projectId };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduledAlertEvaluation() {
    const activeRules = await db
      .select({ orgId: alertRules.orgId, projectId: alertRules.projectId })
      .from(alertRules)
      .where(eq(alertRules.status, "active"));

    const uniqueProjects = new Map<string, { orgId: string; projectId: string }>();
    for (const rule of activeRules) {
      if (!rule.projectId) continue;
      const key = `${rule.orgId}:${rule.projectId}`;
      if (!uniqueProjects.has(key)) {
        uniqueProjects.set(key, { orgId: rule.orgId, projectId: rule.projectId });
      }
    }
    for (const rule of activeRules) {
      if (!rule.projectId) continue;
      const key = `${rule.orgId}:${rule.projectId}`;
      if (!uniqueProjects.has(key)) {
        uniqueProjects.set(key, { orgId: rule.orgId, projectId: rule.projectId });
      }
    }

    for (const { orgId, projectId } of uniqueProjects.values()) {
      try {
        await this.alertEvaluation.evaluateProjectRules(orgId, projectId);
      } catch (error) {
        this.logger.error(
          `Failed to evaluate alerts for ${orgId}/${projectId}: ${
            error instanceof Error ? maskPii(error.message) : String(error)
          }`,
        );
      }
    }
  }

  /** Bounded retention for synthetic probe results (default 30 days). */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async scheduledProbeResultsRetention() {
    try {
      const deleted = await this.syntheticProbes.cleanupOldResults();
      if (deleted > 0) {
        this.logger.log(
          `Pruned ${deleted} synthetic probe results older than 30 days`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to prune synthetic probe results: ${
          error instanceof Error ? maskPii(error.message) : String(error)
        }`,
      );
    }
  }
}
