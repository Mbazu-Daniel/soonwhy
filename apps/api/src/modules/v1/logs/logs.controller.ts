import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LogsService } from './logs.service';
import { getLogsSchema } from './dto';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';

@UseGuards(TenantGuard)
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  async getLogs(@CurrentOrg() org: OrgContext, @Query() query: Record<string, unknown>) {
    const orgId = org.orgId;
    const parsed = getLogsSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.logsService.getLogs(orgId, parsed.data);
  }
}
