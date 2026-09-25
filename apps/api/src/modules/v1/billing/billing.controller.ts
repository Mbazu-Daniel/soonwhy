import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';
import { BillingService } from './billing.service';

@UseGuards(TenantGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('subscription')
  async subscription(@CurrentOrg() org: OrgContext) {
    return this.service.getSubscription(org.orgId);
  }

  @Get('dashboard')
  async dashboard(
    @CurrentOrg() org: OrgContext,
    @Query('projectId') projectId?: string,
  ) {
    return this.service.getDashboard(org.orgId, new Date(), projectId);
  }

  @Get('usage')
  async usage(
    @CurrentOrg() org: OrgContext,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
    @Query('projectId') projectId?: string,
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
