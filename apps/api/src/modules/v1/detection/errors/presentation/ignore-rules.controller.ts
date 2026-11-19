import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, UnauthorizedException, UseGuards } from "@nestjs/common";
import { CurrentOrg, OrgContext } from "../../../../../common/decorators/current-org.decorator";
import { CurrentUser } from "../../../../../common/decorators/current-user.decorator";
import { type AuthUser } from "../../../../../common/decorators/current-user.decorator.types";
import { OwnerOrAdminGuard } from "../../../../../common/guards/owner-or-admin.guard";
import { TenantGuard } from "../../../../../common/middleware/tenant-context.guard";
import { ErrorIgnoreRulesService } from "../application/ignore-rules.service";
import { IgnoreRuleSchema, type IgnoreRuleInput } from "../domain/ignore-rules.schema";

@UseGuards(TenantGuard)
@Controller("projects/:projectId/error-ignore-rules")
export class ErrorIgnoreRulesController {
  constructor(private readonly rules: ErrorIgnoreRulesService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext, @Param("projectId") projectId: string) {
    return this.rules.list({ orgId: org.orgId, projectId });
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
    return this.rules.create({ orgId: org.orgId, projectId }, { ...body, userId: user.id });
  }

  @Put(":ruleId")
  @UseGuards(OwnerOrAdminGuard)
  async update(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("ruleId") ruleId: string,
    @Body({ schema: IgnoreRuleSchema }) body: IgnoreRuleInput,
  ) {
    const row = await this.rules.update({ orgId: org.orgId, projectId }, ruleId, body);
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
    if (!(await this.rules.remove({ orgId: org.orgId, projectId }, ruleId))) {
      throw new NotFoundException("Ignore rule not found");
    }
    return { success: true };
  }
}
