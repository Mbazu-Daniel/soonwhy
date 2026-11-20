import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../../../common/middleware/tenant-context.guard";
import {
  createRetentionPolicyBodySchema,
  exportRetentionDataBodySchema,
  updateRetentionPolicyBodySchema,
} from "../domain/dto";
import { OwnerOrAdminGuard } from "../../../../../common/guards/owner-or-admin.guard";
import { RetentionPoliciesService } from "../application/retention-policies.service";

@Controller("projects/:projectId/retention-policies")
@UseGuards(TenantGuard, OwnerOrAdminGuard)
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
    const parsed = createRetentionPolicyBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.service.createPolicy({
      orgId: org.orgId,
      projectId,
      ...parsed.data,
    });
  }

  @Put(":id")
  async updatePolicy(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    const parsed = updateRetentionPolicyBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.service.updatePolicy({ orgId: org.orgId, projectId }, id, parsed.data);
  }

  @Delete(":id")
  async deletePolicy(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id", ParseIntPipe) id: number,
  ) {
    await this.service.deletePolicy({ orgId: org.orgId, projectId }, id);
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
    @Body() body: unknown,
  ) {
    const parsed = exportRetentionDataBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.service.exportDataBeforeDeletion(
      org.orgId,
      projectId,
      parsed.data.dataType,
      new Date(parsed.data.beforeDate),
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
