import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentOrg, OrgContext } from "../../../../../common/decorators/current-org.decorator";
import { CurrentUser } from "../../../../../common/decorators/current-user.decorator";
import { OwnerOrAdminGuard } from "../../../../../common/guards/owner-or-admin.guard";
import { TenantGuard } from "../../../../../common/middleware/tenant-context.guard";
import {
  CreateServiceAccountDto,
  CreateServiceAccountKeyDto,
  UpdateServiceAccountDto,
  type CreateServiceAccountInput,
  type CreateServiceAccountKeyInput,
} from "../domain/service-accounts.dto";
import { ServiceAccountsService } from "../application/service-accounts.service";

@UseGuards(TenantGuard, OwnerOrAdminGuard)
@Controller("service-accounts")
export class ServiceAccountsController {
  constructor(private readonly service: ServiceAccountsService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext) {
    return this.service.list(org.orgId);
  }

  @Post()
  create(
    @CurrentOrg() org: OrgContext,
    @CurrentUser("id") userId: string | undefined,
    @Body({ schema: CreateServiceAccountDto }) body: CreateServiceAccountInput,
  ) {
    return this.service.create(org.orgId, userId, body);
  }

  @Patch(":id")
  update(
    @CurrentOrg() org: OrgContext,
    @Param("id") id: string,
    @Body({ schema: UpdateServiceAccountDto }) body: { disabled: boolean },
  ) {
    return this.service.setDisabled(org.orgId, id, body.disabled);
  }

  @Delete(":id")
  remove(@CurrentOrg() org: OrgContext, @Param("id") id: string) {
    return this.service.remove(org.orgId, id);
  }

  @Get(":id/keys")
  keys(@CurrentOrg() org: OrgContext, @Param("id") id: string) {
    return this.service.listKeys(org.orgId, id);
  }

  @Post(":id/keys")
  createKey(
    @CurrentOrg() org: OrgContext,
    @Param("id") id: string,
    @Body({ schema: CreateServiceAccountKeyDto }) body: CreateServiceAccountKeyInput,
  ) {
    return this.service.createKey(org.orgId, id, body);
  }
}
