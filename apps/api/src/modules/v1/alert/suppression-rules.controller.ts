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
import { SuppressionRulesService } from "./suppression-rules.service";

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
    @Body() body: any,
  ) {
    return this.service.createRule({
      orgId: org.orgId,
      projectId,
      ...body,
    });
  }

  @Put(":id")
  async updateRule(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Body() body: any,
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
    @Body() body: {
      alertRuleId: string;
      service: string;
      severity: string;
    },
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
