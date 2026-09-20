import { BadRequestException, Controller, Get, Headers, Param, Query, UseGuards } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { getRequestsStatsSchema } from './dto';
import { CurrentOrg, OrgContext, TenantGuard } from '../../../common';

@Controller('projects/:projectId/requests')
@UseGuards(TenantGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get('stats')
  async getStats(
    @Param('projectId') projectId: string,
    @Query() query: Record<string, unknown>,
    @Headers('x-org-id') orgId: string,
    @CurrentOrg() org: OrgContext,
  ) {
    if (!orgId || orgId !== org.id) {
      throw new BadRequestException('Organization context mismatch');
    }
    const parsed = getRequestsStatsSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.requestsService.getStats(org.id, projectId, parsed.data);
  }
}