import { Controller, Get, UseGuards } from '@nestjs/common';
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
}
