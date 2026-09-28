import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';
import type { IssueLifecycleStatus } from './issue-lifecycle.types';
import { IssueLifecycleQueryService } from './issue-lifecycle.query.service';

@UseGuards(TenantGuard)
@Controller('projects/:projectId/issues')
export class IssueLifecycleController {
  constructor(
    private readonly queryService: IssueLifecycleQueryService,
  ) {}

  @Get()
  async list(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Query('status') status?: IssueLifecycleStatus,
    @Query('limit') limit?: string,
  ) {
    return this.queryService.list(
      org.orgId,
      projectId,
      status === 'active' || status === 'resolved' ? status : undefined,
      Number.isFinite(Number(limit)) ? Number(limit) : 50,
    );
  }

  @Get(':issueKey')
  async get(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Param('issueKey') issueKey: string,
  ) {
    return this.queryService.get(org.orgId, projectId, issueKey);
  }
}
