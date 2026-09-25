import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';
import { RcaApiService } from './rca.api';
import { z } from 'zod';

const RcaRequestSchema = z.object({
  regenerate: z.boolean().optional().default(false),
}).strict();

@Controller('projects/:projectId/findings/:findingId/rca')
@UseGuards(TenantGuard)
export class RcaController {
  constructor(private readonly rcaApi: Pick<RcaApiService, 'getLatest' | 'getHistory' | 'generate'>) {}

  @Get()
  getLatest(@CurrentOrg() org: OrgContext, @Param('projectId') projectId: string, @Param('findingId') findingId: string) {
    return this.rcaApi.getLatest(org.orgId, projectId, findingId);
  }

  @Get('history')
  getHistory(@CurrentOrg() org: OrgContext, @Param('projectId') projectId: string, @Param('findingId') findingId: string) {
    return this.rcaApi.getHistory(org.orgId, projectId, findingId);
  }

  @Post()
  generate(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Param('findingId') findingId: string,
    @Body() body: unknown,
  ) {
    const input = RcaRequestSchema.parse(body ?? {});
    return this.rcaApi.generate(org.orgId, projectId, findingId, input.regenerate);
  }
}
