import { Controller, Post, Body, Query, UseGuards } from "@nestjs/common";
import { WeeklySummaryService } from "@soonwhy/shared";
import { AlertEvaluationService } from "./alert-evaluation.service";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { CurrentOrg, OrgContext } from "../../../common/decorators/current-org.decorator";

@Controller("notifications/cron")
export class CronController {
  constructor(
    private readonly service: WeeklySummaryService,
    private readonly alertEvaluation: AlertEvaluationService,
  ) {}

  @Post("weekly-summary")
  async weeklySummary(
    @Body() body: { from: string; to: string; summary: Record<string, string> },
  ) {
    return this.service.dispatchWeeklySummary({
      from: body.from,
      to: body.to,
      summary: body.summary,
    });
  }

  @UseGuards(TenantGuard)
  @Post("evaluate-alerts")
  async evaluateAlerts(
    @CurrentOrg() org: OrgContext,
    @Query("projectId") projectId?: string,
  ) {
    if (!projectId) {
      return { error: "projectId is required" };
    }
    await this.alertEvaluation.evaluateProjectRules(org.orgId, projectId);
    return { evaluated: true, projectId };
  }
}
