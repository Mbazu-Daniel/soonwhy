import { Injectable } from "@nestjs/common";
import { applyIssueLifecycle } from "../domain/issue-lifecycle.coordinator";
import { type IssueLifecycleResult } from "../domain/issue-lifecycle.coordinator.types";
import { createIssueKey } from "../domain/issue-lifecycle.engine";
import { IssueLifecycleRepository } from "../infrastructure/issue-lifecycle.repository";
import type { IssueLifecycleStatus } from "../domain/issue-lifecycle.types";
import type { PersistIssueLifecycleInput } from "../domain/issue-lifecycle.service.types";

@Injectable()
export class IssueLifecycleService {
  constructor(private readonly repository: IssueLifecycleRepository) {}

  list(
    orgId: string,
    projectId: string,
    status: IssueLifecycleStatus | undefined,
    limit: number,
  ) {
    return this.repository.list(orgId, projectId, status, limit);
  }

  find(orgId: string, projectId: string, issueKey: string) {
    return this.repository.find(orgId, projectId, issueKey);
  }

  async apply(
    input: PersistIssueLifecycleInput,
  ): Promise<IssueLifecycleResult> {
    const issueKey = createIssueKey(input.issue.identity);
    const current = await this.repository.find(
      input.orgId,
      input.projectId,
      issueKey,
    );
    const result = applyIssueLifecycle(input.issue, current);

    if (!result.lifecycle) return result;

    const lifecycle = await this.repository.save({
      orgId: input.orgId,
      projectId: input.projectId,
      lifecycle: result.lifecycle,
    });

    return { action: result.action, lifecycle };
  }
}
