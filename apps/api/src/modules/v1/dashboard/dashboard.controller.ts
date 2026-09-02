import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';

@UseGuards(TenantGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('health')
  async getHealthScore(@CurrentOrg() org: OrgContext, @Query('projectId') projectId: string) {
    return this.dashboardService.getHealthScore(org.orgId, projectId);
  }

  @Get('metrics')
  async getMetrics(@CurrentOrg() org: OrgContext, @Query('projectId') projectId: string) {
    return this.dashboardService.getMetrics(org.orgId, projectId);
  }

  @Get('services')
  async getServices(@CurrentOrg() org: OrgContext, @Query('projectId') projectId: string) {
    return this.dashboardService.getServices(org.orgId, projectId);
  }

  @Get('errors')
  async getErrors(
    @CurrentOrg() org: OrgContext,
    @Query('projectId') projectId: string,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardService.getErrors(org.orgId, projectId, limit ? parseInt(limit, 10) : 50);
  }

  @Get('logs')
  async getLogs(
    @CurrentOrg() org: OrgContext,
    @Query('projectId') projectId: string,
    @Query('limit') limit?: string,
    @Query('level') level?: string,
  ) {
    return this.dashboardService.getLogs(org.orgId, projectId, limit ? parseInt(limit, 10) : 100, level);
  }
}
