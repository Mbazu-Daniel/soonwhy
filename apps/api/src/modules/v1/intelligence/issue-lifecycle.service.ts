import type { Issue } from './issue.types';
import {
  applyIssueLifecycle,
  type IssueLifecycleResult,
} from './issue-lifecycle.coordinator';
import {
  createIssueKey,
} from './issue-lifecycle.engine';
import {
  IssueLifecycleRepository,
  type SaveIssueLifecycleInput,
} from './issue-lifecycle.repository';

export interface PersistIssueLifecycleInput {
  orgId: string;
  projectId: string;
  issue: Issue;
}

export class IssueLifecycleService {
  constructor(private readonly repository = new IssueLifecycleRepository()) {}

  async apply(input: PersistIssueLifecycleInput): Promise<IssueLifecycleResult> {
    const issueKey = createIssueKey(input.issue.identity);
    const current = await this.repository.find(input.orgId, input.projectId, issueKey);
    const result = applyIssueLifecycle(input.issue, current);

    if (!result.lifecycle) return result;

    const saveInput: SaveIssueLifecycleInput = {
      orgId: input.orgId,
      projectId: input.projectId,
      lifecycle: result.lifecycle,
    };

    const lifecycle = await this.repository.save(saveInput);
    return { action: result.action, lifecycle };
  }
}
