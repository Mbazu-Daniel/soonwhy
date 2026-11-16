import {
  Controller,
  Logger,
  Optional,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CronLeaseService } from "../../../common/cron/cron-lease.service";
import { AlertEvaluationService } from "./alert-evaluation.service";
import { maskPii } from "../../../common/privacy/pii-masker";
import { db } from "../../../common/db";
import { alertRules } from "../../../common/db/schema";
import { eq } from "drizzle-orm";
import { SyntheticProbesService } from "../synthetic-probes/synthetic-probes.service";

@Controller("notifications/cron")
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(
    private readonly alertEvaluation: AlertEvaluationService,
    private readonly syntheticProbes: SyntheticProbesService,
    @Optional() private readonly lease?: CronLeaseService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduledAlertEvaluation() {
    if (this.lease) {
      await this.lease.runExclusive("alert-evaluation", 55_000, () =>
        this.evaluateAllProjects(),
      );
      return;
    }
    await this.evaluateAllProjects();
  }

  private async evaluateAllProjects() {
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

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async scheduledProbeResultsRetention() {
    const run = async () => {
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
    };

    if (this.lease) {
      await this.lease.runExclusive("probe-results-retention", 10 * 60 * 1000, run);
      return;
    }
    await run();
  }
}
