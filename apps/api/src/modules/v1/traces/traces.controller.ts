import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TracesService } from './traces.service';
import { getTracesSchema } from './dto';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';

@UseGuards(TenantGuard)
@Controller('projects/:projectId/traces')
export class TracesController {
  constructor(private readonly tracesService: TracesService) {}

  @Get()
  async listTraces(@CurrentOrg() org: OrgContext, @Param('projectId') projectId: string, @Query() query: Record<string, unknown>) {
    const parsed = getTracesSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.tracesService.listTraces(org.orgId, { ...parsed.data, projectId });
  }

  @Get(':traceId')
  async getTrace(@CurrentOrg() org: OrgContext, @Param('projectId') projectId: string, @Param('traceId') traceId: string) {
    return this.tracesService.getTrace(org.orgId, projectId, traceId);
  }
}
