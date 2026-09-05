import { Controller, Get, Query, Headers, BadRequestException } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { getRequestsStatsSchema } from './dto';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get('stats')
  async getStats(@Query() query: Record<string, unknown>, @Headers('x-org-id') orgId: string) {
    if (!orgId) throw new BadRequestException('X-Org-Id header required');
    const parsed = getRequestsStatsSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.requestsService.getStats(orgId, parsed.data);
  }
}
