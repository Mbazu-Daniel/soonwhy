import { Body, Controller, Get, Param, Post, NotFoundException, Query, UnauthorizedException, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser, type AuthUser } from "../../../common/decorators/current-user.decorator";
import { ERROR_FINGERPRINT_PATTERN } from "../errors/error.constants";
import { ErrorStatusSchema } from "../errors/error-status.schema";
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

  @Post("errors/:fingerprint/status")
  async setErrorStatus(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser | null,
    @Param("projectId") projectId: string,
    @Param("fingerprint") fingerprint: string,
    @Body({ schema: ErrorStatusSchema }) body: z.output<typeof ErrorStatusSchema>,
  ) {
    if (!user) throw new UnauthorizedException("Sign in to change an issue status");
    if (!ERROR_FINGERPRINT_PATTERN.test(fingerprint)) throw new NotFoundException("Error group not found");
    return this.errorsService.setStatus(org.orgId, projectId, fingerprint, body.status, user.id);
  }
}
