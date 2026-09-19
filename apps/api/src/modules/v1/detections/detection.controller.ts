import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';
import { DetectionService } from './detection.service';

@UseGuards(TenantGuard)
@Controller('detections')
export class DetectionController {
  constructor(private readonly detectionService: DetectionService) {}

  @Post('run')
  async run(@CurrentOrg() org: OrgContext, @Query('projectId') projectId: string) {
    return this.detectionService.run(org.orgId, projectId);
  }

  @Get()
  async list(
    @CurrentOrg() org: OrgContext,
    @Query('projectId') projectId: string,
    @Query('limit') limit?: string,
  ) {
    return this.detectionService.list(org.orgId, projectId, limit ? Number(limit) : 50);
  }
}
