import { Injectable, NotFoundException } from "@nestjs/common";
import type { FindingStatus } from "../../../../../common/db/schema/finding-lifecycle";
import { buildFindingReport } from "../domain/finding-report";
import { DEPLOY_SUSPECT_WINDOW_MS } from "../domain/finding.constants";
import type { FindingListQuery, SuspectDeployment } from "../domain/finding.types";
import { FindingRepository } from "../infrastructure/finding.repository";

@Injectable()
export class FindingsService {
  constructor(private readonly repository: FindingRepository) {}

  list(orgId: string, projectId: string, query: FindingListQuery) {
    return this.repository.list(orgId, projectId, query);
  }

  summary(orgId: string, projectId: string) {
    return this.repository.summary(orgId, projectId);
  }

  async report(orgId: string, projectId: string, days: number, now = new Date()) {
    const period = { from: new Date(now.getTime() - days * 86_400_000), to: now };
    const rows = await this.repository.reportRows(orgId, projectId, period.from);
    return buildFindingReport(rows, period, now);
  }

  async get(orgId: string, projectId: string, id: string) {
    const row = await this.repository.find(orgId, projectId, id);
    if (!row) throw new NotFoundException("Finding not found");
    return { ...row, suspectDeployment: await this.suspectDeployment(projectId, row) };
  }

  private async suspectDeployment(
    projectId: string,
    row: { serviceName: string; detectedAt: Date },
  ): Promise<SuspectDeployment | null> {
    const deploy = await this.repository.latestDeployBefore(projectId, row.serviceName, row.detectedAt, DEPLOY_SUSPECT_WINDOW_MS);
    if (!deploy?.deployedAt) return null;
    return {
      version: deploy.version,
      commitSha: deploy.commitSha,
      deployedAt: deploy.deployedAt,
      minutesBeforeFinding: Math.round((row.detectedAt.getTime() - deploy.deployedAt.getTime()) / 60_000),
    };
  }

  async setStatus(orgId: string, projectId: string, id: string, status: FindingStatus, userId: string | null) {
    const row = await this.repository.setStatus(orgId, projectId, id, status, userId);
    if (!row) throw new NotFoundException("Finding not found");
    return row;
  }
}
