import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentOrg, OrgContext } from "../../../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../../../common/middleware/tenant-context.guard";
import { VulnerabilityScanService } from "../application/vulnerability-scan.service";
import { DependencySnapshotBodySchema } from "../domain/vulnerability.schema";
import type { DependencySnapshotBody } from "../domain/vulnerability.types";

@UseGuards(TenantGuard)
@Controller("projects/:projectId/dependencies")
export class DependenciesController {
  constructor(private readonly scans: VulnerabilityScanService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext, @Param("projectId") projectId: string) {
    return this.scans.list(org.orgId, projectId);
  }

  @Post()
  submit(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body({ schema: DependencySnapshotBodySchema }) body: DependencySnapshotBody,
  ) {
    return this.scans.submit(org.orgId, projectId, body);
  }
}
