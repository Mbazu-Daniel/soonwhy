import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';
import { InvestigationService } from './investigation.service';

@UseGuards(TenantGuard)
@Controller('projects/:projectId/investigations')
export class InvestigationController {
  constructor(private readonly service: InvestigationService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext, @Param('projectId') projectId: string) {
    return this.service.list(projectId, org.orgId);
  }

  @Get(':id/graph')
  graph(@CurrentOrg() org: OrgContext, @Param('projectId') projectId: string, @Param('id') id: string) {
    return this.service.getGraph(id, projectId, org.orgId);
  }

  @Get(':id')
  getById(@CurrentOrg() org: OrgContext, @Param('projectId') projectId: string, @Param('id') id: string) {
    return this.service.getById(id, projectId, org.orgId);
  }

  @Post()
  start(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Query('findingId') findingId: string,
  ) {
    return this.service.start(findingId, projectId, org.orgId);
  }
}
