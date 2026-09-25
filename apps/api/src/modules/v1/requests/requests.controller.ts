import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { getRequestsStatsSchema } from './dto';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';

@UseGuards(TenantGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get('stats')
  async getStats(@CurrentOrg() org: OrgContext, @Query() query: Record<string, unknown>) {
    const orgId = org.orgId;
    const parsed = getRequestsStatsSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.requestsService.getStats(orgId, parsed.data);
  }
}
