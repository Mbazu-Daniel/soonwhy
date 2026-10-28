import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { NotificationService } from "./notification.service";
import {
  CreateAlertRuleDto,
  UpdateAlertRuleDto,
} from "./dto/create-alert-rule.dto";

@UseGuards(TenantGuard)
@Controller("notifications")
export class OrgNotificationsController {
  constructor(private readonly service: NotificationService) {}

  @Get("alert-rules")
  listOrgAlertRules(@CurrentOrg() org: OrgContext) {
    return this.service.listOrgAlertRules(org.orgId);
  }

  @Post("alert-rules")
  createOrgAlertRule(@CurrentOrg() org: OrgContext, @Body() body: unknown) {
    const input = CreateAlertRuleDto.parse(body);
    return this.service.createOrgAlertRule(org.orgId, {
      ...input,
      description: input.description ?? null,
      channelIds: input.channelIds ?? [],
    } as Parameters<NotificationService["createOrgAlertRule"]>[1]);
  }

  @Put("alert-rules/:ruleId")
  updateOrgAlertRule(
    @CurrentOrg() org: OrgContext,
    @Param("ruleId") ruleId: string,
    @Body() body: unknown,
  ) {
    const input = UpdateAlertRuleDto.parse(body);
    return this.service.updateOrgAlertRule(org.orgId, ruleId, input);
  }

  @Delete("alert-rules/:ruleId")
  deleteOrgAlertRule(@CurrentOrg() org: OrgContext, @Param("ruleId") ruleId: string) {
    return this.service.deleteOrgAlertRule(org.orgId, ruleId);
  }
}
