import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { CurrentOrg, OrgContext } from "../../../../../common/decorators/current-org.decorator";
import { OwnerOrAdminGuard } from "../../../../../common/guards/owner-or-admin.guard";
import { TenantGuard } from "../../../../../common/middleware/tenant-context.guard";
import { MoveHostDto, type MoveHostInput } from "../domain/dto";
import { HostsService } from "../application/hosts.service";

@UseGuards(TenantGuard)
@Controller("projects/:projectId/hosts")
export class HostsController {
  constructor(private readonly hostsService: HostsService) {}

  @Get()
  async list(@CurrentOrg() org: OrgContext, @Param("projectId") projectId: string) {
    return this.hostsService.listForProject(org.orgId, projectId);
  }

  @Patch(":hostId")
  @UseGuards(OwnerOrAdminGuard)
  async move(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("hostId") hostId: string,
    @Body({ schema: MoveHostDto }) body: MoveHostInput,
  ) {
    return this.hostsService.moveHost(org.orgId, projectId, hostId, body.projectId);
  }
}
