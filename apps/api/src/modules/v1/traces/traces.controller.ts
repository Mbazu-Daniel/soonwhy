import { Controller, Get, Query, Param, Headers, BadRequestException } from '@nestjs/common';
import { TracesService } from './traces.service';
import { getTracesSchema } from './dto';

@Controller('traces')
export class TracesController {
  constructor(private readonly tracesService: TracesService) {}

  @Get()
  async listTraces(@Query() query: Record<string, unknown>, @Headers('x-org-id') orgId: string) {
    if (!orgId) throw new BadRequestException('X-Org-Id header required');
    const parsed = getTracesSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.tracesService.listTraces(orgId, parsed.data);
  }

  @Get(':traceId')
  async getTrace(@Param('traceId') traceId: string, @Query() query: Record<string, unknown>, @Headers('x-org-id') orgId: string) {
    if (!orgId) throw new BadRequestException('X-Org-Id header required');
    const projectId = query.projectId as string;
    if (!projectId) throw new BadRequestException('projectId query required');
    return this.tracesService.getTrace(orgId, projectId, traceId);
  }
}
