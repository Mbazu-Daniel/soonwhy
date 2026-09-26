import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';
import { BillingService } from './billing.service';

@UseGuards(TenantGuard)
@Controller('projects/:projectId/billing')
export class ProjectBillingController {
  constructor(private readonly service: BillingService) {}

  @Get('dashboard')
  async dashboard(@CurrentOrg() org: OrgContext, @Param('projectId') projectId: string) {
    return this.service.getDashboard(org.orgId, new Date(), projectId);
  }

  @Get('usage')
  async usage(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
  ) {
    const end = periodEnd ? new Date(periodEnd) : new Date();
    const start = periodStart
      ? new Date(periodStart)
      : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw new BadRequestException('Invalid billing period');
    }

    return this.service.getUsage(org.orgId, start, end, projectId);
  }
}
