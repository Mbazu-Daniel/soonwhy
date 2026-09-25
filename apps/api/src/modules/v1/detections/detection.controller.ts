import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';
import { DetectionService } from './detection.service';

@UseGuards(TenantGuard)
@Controller('projects/:projectId/detections')
export class DetectionController {
  constructor(private readonly detectionService: DetectionService) {}

  @Post('run')
  async run(@CurrentOrg() org: OrgContext, @Param('projectId') projectId: string) {
    return this.detectionService.run(org.orgId, projectId);
  }

  @Get()
  async list(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
  ) {
    return this.detectionService.list(org.orgId, projectId);
  }
}
