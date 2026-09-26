import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TracesService } from './traces.service';
import { getTracesSchema } from './dto';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';

@UseGuards(TenantGuard)
@Controller('traces')
export class TracesController {
  constructor(private readonly tracesService: TracesService) {}

  @Get()
  async listTraces(@CurrentOrg() org: OrgContext, @Query() query: Record<string, unknown>) {
    const orgId = org.orgId;
    const parsed = getTracesSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.tracesService.listTraces(orgId, parsed.data);
  }

  @Get(':traceId')
  async getTrace(@CurrentOrg() org: OrgContext, @Param('traceId') traceId: string, @Query() query: Record<string, unknown>) {
    const orgId = org.orgId;
    const projectId = query.projectId as string;
    if (!projectId) throw new BadRequestException('projectId query required');
    return this.tracesService.getTrace(orgId, projectId, traceId);
  }
}
