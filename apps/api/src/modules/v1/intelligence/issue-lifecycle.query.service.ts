import { Injectable } from '@nestjs/common';
import type { IssueLifecycle, IssueLifecycleStatus } from './issue-lifecycle.types';
import { IssueLifecycleRepository } from './issue-lifecycle.repository';

@Injectable()
export class IssueLifecycleQueryService {
  constructor(
    private readonly repository: IssueLifecycleRepository,
  ) {}

  async list(
    orgId: string,
    projectId: string,
    status?: IssueLifecycleStatus,
    limit = 50,
  ): Promise<IssueLifecycle[]> {
    return this.repository.list(orgId, projectId, status, limit);
  }

  async get(
    orgId: string,
    projectId: string,
    issueKey: string,
  ): Promise<IssueLifecycle | undefined> {
    return this.repository.find(orgId, projectId, issueKey);
  }
}
