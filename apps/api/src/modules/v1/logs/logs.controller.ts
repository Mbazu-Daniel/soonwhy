import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LogsService } from './logs.service';
import { getLogsSchema } from './dto';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';

@UseGuards(TenantGuard)
@Controller('projects/:projectId/logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  async getLogs(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = getLogsSchema.safeParse({ ...query, projectId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.logsService.getLogs(org.orgId, parsed.data);
  }
}
