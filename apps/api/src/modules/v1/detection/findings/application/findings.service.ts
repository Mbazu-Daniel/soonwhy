import { Injectable, NotFoundException } from "@nestjs/common";
import type { FindingStatus } from "../../../../../common/db/schema/finding-lifecycle";
import { buildFindingReport } from "../domain/finding-report";
import type { FindingListQuery } from "../domain/finding.types";
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
    return row;
  }

  async setStatus(orgId: string, projectId: string, id: string, status: FindingStatus, userId: string | null) {
    const row = await this.repository.setStatus(orgId, projectId, id, status, userId);
    if (!row) throw new NotFoundException("Finding not found");
    return row;
  }
}
