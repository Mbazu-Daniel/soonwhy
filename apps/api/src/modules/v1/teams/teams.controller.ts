import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import {
  CreateTeamDto,
  type CreateTeamInput,
} from "./dto/create-team.dto";
import { TeamsService } from "./teams.service";

@UseGuards(TenantGuard)
@Controller("teams")
export class TeamsController {
  constructor(private readonly service: TeamsService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext) {
    return this.service.list(org.orgId);
  }

  @Post()
  create(
    @CurrentOrg() org: OrgContext,
    @Body({ schema: CreateTeamDto }) body: CreateTeamInput,
  ) {
    return this.service.create(org.orgId, body);
  }
}
