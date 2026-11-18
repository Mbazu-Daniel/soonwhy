import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, UnauthorizedException, UseGuards } from "@nestjs/common";
import { CurrentOrg, OrgContext } from "../../../common/decorators/current-org.decorator";
import { CurrentUser, type AuthUser } from "../../../common/decorators/current-user.decorator";
import { OwnerOrAdminGuard } from "../../../common/guards/owner-or-admin.guard";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { createIgnoreRule, deleteIgnoreRule, listIgnoreRules, updateIgnoreRule } from "./ignore-rules.store";
import { IgnoreRuleSchema, type IgnoreRuleInput } from "./ignore-rules.schema";

@UseGuards(TenantGuard)
@Controller("projects/:projectId/error-ignore-rules")
export class ErrorIgnoreRulesController {
  @Get()
  list(@CurrentOrg() org: OrgContext, @Param("projectId") projectId: string) {
    return listIgnoreRules({ orgId: org.orgId, projectId });
  }

  @Post()
  @UseGuards(OwnerOrAdminGuard)
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser | null,
    @Param("projectId") projectId: string,
    @Body({ schema: IgnoreRuleSchema }) body: IgnoreRuleInput,
  ) {
    if (!user) throw new UnauthorizedException("Sign in to add an ignore rule");
    return createIgnoreRule({ orgId: org.orgId, projectId }, { ...body, userId: user.id });
  }

  @Put(":ruleId")
  @UseGuards(OwnerOrAdminGuard)
  async update(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("ruleId") ruleId: string,
    @Body({ schema: IgnoreRuleSchema }) body: IgnoreRuleInput,
  ) {
    const row = await updateIgnoreRule({ orgId: org.orgId, projectId }, ruleId, body);
    if (!row) throw new NotFoundException("Ignore rule not found");
    return row;
  }

  @Delete(":ruleId")
  @UseGuards(OwnerOrAdminGuard)
  async remove(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("ruleId") ruleId: string,
  ) {
    if (!(await deleteIgnoreRule({ orgId: org.orgId, projectId }, ruleId))) {
      throw new NotFoundException("Ignore rule not found");
    }
    return { success: true };
  }
}
