import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { CurrentOrg, OrgContext } from "../../../../../common/decorators/current-org.decorator";
import { CurrentUser } from "../../../../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../../../../common/decorators/current-user.decorator.types";
import { TenantGuard } from "../../../../../common/middleware/tenant-context.guard";
import { FindingsService } from "../application/findings.service";
import { FindingListQuerySchema, FindingReportQuerySchema, FindingStatusBodySchema } from "../domain/finding.schema";
import type { FindingStatusBody } from "../domain/finding.types";

@UseGuards(TenantGuard)
@Controller("projects/:projectId/findings")
export class FindingsController {
  constructor(private readonly findings: FindingsService) {}

  @Get()
  list(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query() query: Record<string, string>,
  ) {
    return this.findings.list(org.orgId, projectId, FindingListQuerySchema.parse(query));
  }

  @Get("summary")
  summary(@CurrentOrg() org: OrgContext, @Param("projectId") projectId: string) {
    return this.findings.summary(org.orgId, projectId);
  }

  @Get("report")
  report(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query() query: Record<string, string>,
  ) {
    return this.findings.report(org.orgId, projectId, FindingReportQuerySchema.parse(query).days);
  }

  @Get(":findingId")
  get(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("findingId") findingId: string,
  ) {
    return this.findings.get(org.orgId, projectId, findingId);
  }

  @Patch(":findingId/status")
  setStatus(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthUser | null,
    @Param("projectId") projectId: string,
    @Param("findingId") findingId: string,
    @Body({ schema: FindingStatusBodySchema }) body: FindingStatusBody,
  ) {
    return this.findings.setStatus(org.orgId, projectId, findingId, body.status, user?.id ?? null);
  }
}
