import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { ErrorsService } from "../errors";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";

@UseGuards(TenantGuard)
@Controller("projects/:projectId/dashboard")
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly errorsService: ErrorsService,
  ) {}

  @Get("overview")
  async getOverview(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.dashboardService.getOverview(org.orgId, projectId, from, to);
  }

  @Get("telemetry-status")
  async getTelemetryStatus(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.dashboardService.getTelemetryStatus(org.orgId, projectId);
  }

  @Get("services")
  async getServices(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.dashboardService.getServices(org.orgId, projectId, from, to);
  }

  @Get("errors")
  async getErrors(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("limit") limit?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("service") service?: string,
  ) {
    return this.errorsService.listGroups(org.orgId, projectId, {
      limit: limit ? parseInt(limit, 10) : 50,
      from,
      to,
      service,
    });
  }

  @Get("errors/:fingerprint")
  async getError(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("fingerprint") fingerprint: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.errorsService.getGroup(org.orgId, projectId, fingerprint, { from, to });
  }

  @Post("errors/:fingerprint/finding")
  async createErrorFinding(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("fingerprint") fingerprint: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.errorsService.createFinding(org.orgId, projectId, fingerprint, { from, to });
  }
}
