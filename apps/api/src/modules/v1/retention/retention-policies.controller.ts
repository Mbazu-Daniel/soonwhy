import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import {
  createRetentionPolicyBodySchema,
  exportRetentionDataBodySchema,
  updateRetentionPolicyBodySchema,
} from "./dto";
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
  async updatePolicy(@Param("id") id: string, @Body() body: unknown) {
    const parsed = updateRetentionPolicyBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.service.updatePolicy(Number(id), parsed.data);
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
