import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { RetentionPoliciesService } from "./retention-policies.service";

@Controller("projects/:projectId/retention-policies")
@UseGuards(TenantGuard)
export class RetentionPoliciesController {
  constructor(private readonly service: RetentionPoliciesService) {}

  @Get()
  async getPolicies(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.service.getPolicies(org.orgId, projectId);
  }

  @Post()
  async createPolicy(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body() body: unknown,
  ) {
    return this.service.createPolicy({
      orgId: org.orgId,
      projectId,
      dataType: (body as any).dataType,
      retentionDays: (body as any).retentionDays,
      maxStorageGb: (body as any).maxStorageGb,
      autoCleanup: (body as any).autoCleanup,
      cleanupSchedule: (body as any).cleanupSchedule,
    });
  }

  @Put(":id")
  async updatePolicy(@Param("id") id: string, @Body() body: unknown) {
    return this.service.updatePolicy(Number(id), {
      retentionDays: (body as any).retentionDays,
      maxStorageGb: (body as any).maxStorageGb,
      autoCleanup: (body as any).autoCleanup,
      cleanupSchedule: (body as any).cleanupSchedule,
      isActive: (body as any).isActive,
    });
  }

  @Delete(":id")
  async deletePolicy(@Param("id") id: string) {
    await this.service.deletePolicy(Number(id));
    return { message: "Deleted" };
  }

  @Post("execute-cleanup")
  async executeCleanup(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.service.executeCleanup(org.orgId, projectId);
  }

  @Post("export")
  async exportData(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body() body: { dataType: string; beforeDate: string },
  ) {
    return this.service.exportDataBeforeDeletion(
      org.orgId,
      projectId,
      body.dataType,
      new Date(body.beforeDate),
    );
  }

  @Get("optimization-recommendations")
  async getOptimizationRecommendations(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.service.getOptimizationRecommendations(org.orgId, projectId);
  }
}
