import { BadRequestException, Controller, Get, Headers, Param, Query, UseGuards } from '@nestjs/common';
import { LogsService } from './logs.service';
import { getLogsSchema } from './dto';
import { CurrentOrg, OrgContext, TenantGuard } from '../../../common';

@Controller('projects/:projectId/logs')
@UseGuards(TenantGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  async getLogs(
    @Param('projectId') projectId: string,
    @Query() query: Record<string, unknown>,
    @Headers('x-org-id') orgId: string,
    @CurrentOrg() org: OrgContext,
  ) {
    if (!orgId || orgId !== org.id) {
      throw new BadRequestException('Organization context mismatch');
    }
    const parsed = getLogsSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.logsService.getLogs(org.id, projectId, parsed.data);
  }
}