import { Controller, Get, Query, Headers, BadRequestException, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { getMetricsSchema } from './dto';
import { CurrentOrg, OrgContext, TenantGuard } from '../../../common';

@Controller('metrics')
@UseGuards(TenantGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Query() query: Record<string, unknown>, @Headers('x-org-id') orgId: string,
    @CurrentOrg() org: OrgContext,
  ) {
    if (!orgId || orgId !== org.id) throw new BadRequestException('Organization context mismatch');
    const parsed = getMetricsSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.metricsService.getMetrics(org.id, parsed.data);
  }
}
