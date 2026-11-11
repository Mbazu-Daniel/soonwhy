import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { SlosService } from "./slos.service";
import { SloAlertingService } from "./slo-alerting.service";

@Controller("projects/:projectId/slos")
@UseGuards(TenantGuard)
export class SlosController {
  constructor(
    private readonly service: SlosService,
    private readonly alertingService: SloAlertingService,
  ) {}

  @Get()
  async getSlos(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.service.getSlos(
      org.orgId,
      projectId,
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
    );
  }

  @Get(":id")
  async getSloById(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id") id: string,
  ) {
    return this.service.getSloById(Number(id), org.orgId, projectId);
  }

  @Get(":id/compliance")
  async calculateCompliance(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id") id: string,
  ) {
    return this.service.calculateSloCompliance(Number(id), org.orgId, projectId);
  }

  @Get(":id/snapshots")
  async getComplianceSnapshots(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.getComplianceSnapshots(Number(id), org.orgId, projectId, limit ? Number(limit) : 100);
  }

  @Get("snapshots/recent")
  async getRecentSnapshots(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("hoursAgo") hoursAgo?: string,
  ) {
    return this.service.getRecentSnapshotsForAllSlos(
      org.orgId,
      projectId,
      hoursAgo ? Number(hoursAgo) : 24,
    );
  }

  @Post()
  async createSlo(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body() body: unknown,
  ) {
    return this.service.createSlo({
      orgId: org.orgId,
      projectId,
      name: (body as any).name,
      description: (body as any).description,
      serviceName: (body as any).serviceName,
      targetPercentage: (body as any).targetPercentage,
      period: (body as any).period,
      measurementType: (body as any).measurementType,
      goodEventsThreshold: (body as any).goodEventsThreshold,
      windowSize: (body as any).windowSize,
      alertOnBurnRate: (body as any).alertOnBurnRate,
      alertThresholds: (body as any).alertThresholds,
    });
  }

  @Put(":id")
  async updateSlo(@Param("id") id: string, @Body() body: unknown) {
    return this.service.updateSlo(Number(id), {
      name: (body as any).name,
      description: (body as any).description,
      targetPercentage: (body as any).targetPercentage,
      period: (body as any).period,
      measurementType: (body as any).measurementType,
      goodEventsThreshold: (body as any).goodEventsThreshold,
      windowSize: (body as any).windowSize,
      alertOnBurnRate: (body as any).alertOnBurnRate,
      alertThresholds: (body as any).alertThresholds,
      isActive: (body as any).isActive,
    });
  }

  @Delete(":id")
  async deleteSlo(@Param("id") id: string) {
    await this.service.deleteSlo(Number(id));
    return { message: "Deleted" };
  }

  @Get("alerts")
  async getSLOAlerts(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.alertingService.getSLOAlerts(org.orgId, projectId);
  }

  @Post("alerts/check")
  async checkSLOAlerts(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    await this.alertingService.checkSLOAlerts(org.orgId, projectId);
    return { message: "SLO alerts checked" };
  }
}
