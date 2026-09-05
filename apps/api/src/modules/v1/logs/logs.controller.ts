import { Controller, Get, Query, Headers, BadRequestException } from '@nestjs/common';
import { LogsService } from './logs.service';
import { getLogsSchema } from './dto';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  async getLogs(@Query() query: Record<string, unknown>, @Headers('x-org-id') orgId: string) {
    if (!orgId) throw new BadRequestException('X-Org-Id header required');
    const parsed = getLogsSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.logsService.getLogs(orgId, parsed.data);
  }
}
