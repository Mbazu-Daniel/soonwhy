import { Controller, Get, Query, Headers, BadRequestException } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { getMetricsSchema } from './dto';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Query() query: Record<string, unknown>, @Headers('x-org-id') orgId: string) {
    if (!orgId) throw new BadRequestException('X-Org-Id header required');
    const parsed = getMetricsSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.metricsService.getMetrics(orgId, parsed.data);
  }
}
