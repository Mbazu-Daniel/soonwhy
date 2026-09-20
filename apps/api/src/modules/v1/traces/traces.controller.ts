import { BadRequestException, Controller, Get, Headers, Param, Query, UseGuards } from '@nestjs/common';
import { TracesService } from './traces.service';
import { getTracesSchema } from './dto';
import { CurrentOrg, OrgContext, TenantGuard } from '../../../common';

@Controller('projects/:projectId/traces')
@UseGuards(TenantGuard)
export class TracesController {
  constructor(private readonly tracesService: TracesService) {}

  @Get()
  async listTraces(
    @Param('projectId') projectId: string,
    @Query() query: Record<string, unknown>,
    @Headers('x-org-id') orgId: string,
    @CurrentOrg() org: OrgContext,
  ) {
    if (!orgId || orgId !== org.id) {
      throw new BadRequestException('Organization context mismatch');
    }
    const parsed = getTracesSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.tracesService.listTraces(org.id, projectId, parsed.data);
  }

  @Get(':traceId')
  async getTrace(
    @Param('projectId') projectId: string,
    @Param('traceId') traceId: string,
    @Headers('x-org-id') orgId: string,
    @CurrentOrg() org: OrgContext,
  ) {
    if (!orgId || orgId !== org.id) {
      throw new BadRequestException('Organization context mismatch');
    }
    return this.tracesService.getTrace(org.id, projectId, traceId);
  }
}