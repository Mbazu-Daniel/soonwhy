import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { CapacityMonitoringService } from "./capacity-monitoring.service";

@Controller("projects/:projectId/capacity")
@UseGuards(TenantGuard)
export class CapacityMonitoringController {
  constructor(private readonly service: CapacityMonitoringService) {}

  @Get("metrics")
  async getCapacityMetrics(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("serviceName") serviceName?: string,
    @Query("hoursAgo") hoursAgo?: string,
  ) {
    return this.service.getCapacityMetrics(
      org.orgId,
      projectId,
      serviceName,
      hoursAgo ? Number(hoursAgo) : 24,
    );
  }

  @Get("summary")
  async getCapacitySummary(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("hoursAgo") hoursAgo?: string,
  ) {
    return this.service.getCapacitySummary(
      org.orgId,
      projectId,
      hoursAgo ? Number(hoursAgo) : 1,
    );
  }

  @Get("alerts")
  async getResourceExhaustionAlerts(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("hoursAgo") hoursAgo?: string,
  ) {
    return this.service.getResourceExhaustionAlerts(
      org.orgId,
      projectId,
      hoursAgo ? Number(hoursAgo) : 1,
    );
  }

  @Post("record")
  async recordMetric(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body() body: any,
  ) {
    return this.service.recordMetric({
      orgId: org.orgId,
      projectId,
      ...body,
    });
  }
}
