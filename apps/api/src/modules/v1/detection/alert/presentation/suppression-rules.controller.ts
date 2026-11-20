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
} from "../../../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../../../common/middleware/tenant-context.guard";
import {
  CheckSuppressionDto,
  CreateSuppressionRuleDto,
  UpdateSuppressionRuleDto,
  type CheckSuppressionInput,
  type CreateSuppressionRuleInput,
  type UpdateSuppressionRuleInput,
} from "../domain/suppression-rules.dto";
import { SuppressionRulesService } from "../application/suppression-rules.service";

@Controller("projects/:projectId/alert-suppression-rules")
@UseGuards(TenantGuard)
export class SuppressionRulesController {
  constructor(private readonly service: SuppressionRulesService) {}

  @Get()
  async getRules(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.service.getRules(org.orgId, projectId);
  }

  @Post()
  async createRule(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body({ schema: CreateSuppressionRuleDto }) body: CreateSuppressionRuleInput,
  ) {
    return this.service.createRule({
      ...body,
      orgId: org.orgId,
      projectId,
    });
  }

  @Put(":id")
  async updateRule(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Body({ schema: UpdateSuppressionRuleDto }) body: UpdateSuppressionRuleInput,
  ) {
    return this.service.updateRule({ orgId: org.orgId, projectId }, id, body);
  }

  @Delete(":id")
  async deleteRule(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id") id: string,
  ) {
    await this.service.deleteRule({ orgId: org.orgId, projectId }, id);
    return { message: "Rule deleted" };
  }

  @Post("check")
  async checkSuppression(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body({ schema: CheckSuppressionDto }) body: CheckSuppressionInput,
  ) {
    return this.service.shouldSuppressAlert({
      orgId: org.orgId,
      projectId,
      alertRuleId: body.alertRuleId,
      service: body.service,
      severity: body.severity,
      timestamp: new Date(),
    });
  }
}
