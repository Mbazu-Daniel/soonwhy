import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { createSloBodySchema, updateSloBodySchema } from "./dto";
import { AlertService } from "../alert/alert.service";
import { SlosService } from "./slos.service";

@Controller("projects/:projectId/slos")
@UseGuards(TenantGuard)
export class SlosController {
  constructor(
    private readonly service: SlosService,
    private readonly alertingService: AlertService,
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
    const parsed = createSloBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.service.createSlo({
      orgId: org.orgId,
      projectId,
      ...parsed.data,
    });
  }

  @Put(":id")
  async updateSlo(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateSloBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const slo = await this.service.updateSlo(Number(id), org.orgId, projectId, parsed.data);
    if (!slo) {
      throw new NotFoundException("SLO not found");
    }
    return slo;
  }

  @Delete(":id")
  async deleteSlo(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id") id: string,
  ) {
    await this.service.deleteSlo(Number(id), org.orgId, projectId);
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
