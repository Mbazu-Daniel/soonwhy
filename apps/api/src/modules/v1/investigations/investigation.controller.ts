import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';
import { InvestigationService } from './investigation.service';

@UseGuards(TenantGuard)
@Controller('investigations')
export class InvestigationController {
  constructor(private readonly service: InvestigationService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext, @Query('projectId') projectId: string) {
    return this.service.list(projectId, org.orgId);
  }

  @Get(':id/graph')
  graph(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.service.getGraph(id, org.orgId);
  }

  @Get(':id')
  getById(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.service.getById(id, org.orgId);
  }

  @Post()
  start(
    @CurrentOrg() org: OrgContext,
    @Query('findingId') findingId: string,
  ) {
    return this.service.start(findingId, org.orgId);
  }
}
