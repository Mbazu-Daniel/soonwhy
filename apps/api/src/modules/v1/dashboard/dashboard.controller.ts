import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';

@UseGuards(TenantGuard)
@Controller('projects/:projectId/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboardService.getOverview(org.orgId, projectId, from, to);
  }

  @Get('telemetry-status')
  async getTelemetryStatus(@CurrentOrg() org: OrgContext, @Param('projectId') projectId: string) {
    return this.dashboardService.getTelemetryStatus(org.orgId, projectId);
  }

  @Get('services')
  async getServices(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboardService.getServices(org.orgId, projectId, from, to);
  }

  @Get('errors')
  async getErrors(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardService.getErrors(org.orgId, projectId, limit ? parseInt(limit, 10) : 50);
  }
}
