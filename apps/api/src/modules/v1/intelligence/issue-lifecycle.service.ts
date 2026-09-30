import type { Issue } from './issue.types';
import {
  applyIssueLifecycle,
  type IssueLifecycleResult,
} from './issue-lifecycle.coordinator';
import { createIssueKey } from './issue-lifecycle.engine';
import {
  IssueLifecycleRepository,
  type SaveIssueLifecycleInput,
} from './issue-lifecycle.repository';
import type { IssueLifecycle } from './issue-lifecycle.types';

export interface PersistIssueLifecycleInput {
  orgId: string;
  projectId: string;
  issue: Issue;
}

interface IssueLifecycleRepositoryPort {
  find(orgId: string, projectId: string, issueKey: string): Promise<IssueLifecycle | undefined>;
  save(input: SaveIssueLifecycleInput): Promise<IssueLifecycle>;
}

export class IssueLifecycleService {
  constructor(
    private readonly repository: IssueLifecycleRepositoryPort = new IssueLifecycleRepository(),
  ) {}

  async apply(input: PersistIssueLifecycleInput): Promise<IssueLifecycleResult> {
    const issueKey = createIssueKey(input.issue.identity);
    const current = await this.repository.find(input.orgId, input.projectId, issueKey);
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
