import { Inject, Injectable, Logger } from "@nestjs/common";
import { ErrorsService } from "../errors";
import { RcaApiService } from "../detections/rca.api";
import { RcaService } from "../detections/rca.service";
import { NotificationService } from "../notifications/notification.service";
import { analysisNotification } from "./notification-content";
import { AUTO_ANALYSIS_RUN_BUDGET_MS, SCAN_GROUP_LIMIT } from "./auto-analysis.constants";
import {
  countAutoAnalysesSince,
  getSettings,
  listEnabledOrgIds,
  listProjectIds,
} from "./auto-analysis.store";
import type { AutoAnalysisRun, AutoAnalysisSettings } from "./auto-analysis.types";
import { isMeaningfulGroup } from "./eligibility";
import { evidenceHash } from "./evidence-hash";

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class AutoAnalysisService {
  private readonly logger = new Logger(AutoAnalysisService.name);

  constructor(
    @Inject(ErrorsService) private readonly errors: Pick<ErrorsService, "listGroups" | "createFinding">,
    @Inject(RcaApiService) private readonly rca: Pick<RcaApiService, "getLatest" | "generate">,
    @Inject(RcaService) private readonly credentials: Pick<RcaService, "describe">,
    @Inject(NotificationService) private readonly notifications: Pick<NotificationService, "dispatchAlert">,
  ) {}

  async runAll(now = new Date(), budgetMs = AUTO_ANALYSIS_RUN_BUDGET_MS): Promise<void> {
    const deadline = Date.now() + budgetMs;
    for (const orgId of await listEnabledOrgIds()) {
      if (Date.now() >= deadline) {
        this.logger.warn("Auto-analysis ran out of time; the remaining organizations wait for the next run");
        return;
      }
      try {
        await this.runOrg(orgId, now, deadline);
      } catch (error) {
        this.logger.warn(`Auto-analysis failed for an organization: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  async runOrg(orgId: string, now = new Date(), deadline = Number.POSITIVE_INFINITY): Promise<AutoAnalysisRun> {
    const run: AutoAnalysisRun = { analyzed: 0, skipped: 0, failed: 0, capReached: false };
    const settings = await getSettings(orgId);
    if (!settings.enabled) return run;

    const byok = (await this.credentials.describe(orgId)).source === "byok";
    let remaining = byok
      ? Number.POSITIVE_INFINITY
      : settings.dailyCap - (await countAutoAnalysesSince(orgId, startOfUtcDay(now)));
    for (const projectId of await listProjectIds(orgId)) {
      if (remaining <= 0 || Date.now() >= deadline) break;
      remaining = await this.runProject(orgId, projectId, settings, remaining, run, deadline);
    }
    run.capReached = !byok && remaining <= 0;
    return run;
  }

  private async runProject(
    orgId: string,
    projectId: string,
    settings: AutoAnalysisSettings,
    allowance: number,
    run: AutoAnalysisRun,
    deadline: number,
  ): Promise<number> {
    let remaining = allowance;
    const groups = (await this.errors.listGroups(orgId, projectId, { limit: SCAN_GROUP_LIMIT }))
      .filter((group) => isMeaningfulGroup(group, settings.minOccurrences))
      .sort((a, b) => b.count - a.count);

    for (const group of groups) {
      if (remaining <= 0 || Date.now() >= deadline) break;
      try {
        const { finding } = await this.errors.createFinding(orgId, projectId, group.fingerprint);
        if (!finding) {
          run.failed += 1;
          continue;
        }
        const hash = evidenceHash(finding);
        const latest = await this.rca.getLatest(orgId, projectId, finding.id);
        if (latest && (latest.evidenceHash === null || latest.evidenceHash === hash)) {
          run.skipped += 1;
          continue;
        }
        const analysis = await this.rca.generate(orgId, projectId, finding.id, !!latest, undefined, {
          trigger: "auto",
          evidenceHash: hash,
        });
        run.analyzed += 1;
        remaining -= 1;
        if (finding.severity === "critical") await this.notify(orgId, projectId, finding, analysis);
      } catch (error) {
        run.failed += 1;
        this.logger.warn(`Auto-analysis skipped a group: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return remaining;
  }

  private async notify(
    orgId: string,
    projectId: string,
    finding: Parameters<typeof analysisNotification>[0],
    analysis: Parameters<typeof analysisNotification>[1],
  ): Promise<void> {
    try {
      await this.notifications.dispatchAlert({ orgId, projectId, ...analysisNotification(finding, analysis) });
    } catch (error) {
      this.logger.warn(`Could not send the analysis notification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
