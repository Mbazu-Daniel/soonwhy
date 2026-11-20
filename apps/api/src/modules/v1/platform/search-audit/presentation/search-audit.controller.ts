import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentOrg, OrgContext } from "../../../../../common/decorators/current-org.decorator";
import { OwnerOrAdminGuard } from "../../../../../common/guards/owner-or-admin.guard";
import { TenantGuard } from "../../../../../common/middleware/tenant-context.guard";
import { SearchAuditService } from "../application/search-audit.service";

const positiveInt = (value: string | undefined): number | undefined => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

@UseGuards(TenantGuard, OwnerOrAdminGuard)
@Controller("search-audit")
export class SearchAuditController {
  constructor(private readonly service: SearchAuditService) {}

  @Get()
  list(
    @CurrentOrg() org: OrgContext,
    @Query("projectId") projectId?: string,
    @Query("before") before?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.list(org.orgId, {
      projectId: projectId || undefined,
      before: positiveInt(before),
      limit: positiveInt(limit),
    });
  }
}
