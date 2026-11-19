import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../../../common/decorators/current-org.decorator";
import { actorLabel, CurrentUser } from "../../../../../common/decorators/current-user.decorator";
import { AuthUser } from "../../../../../common/decorators/current-user.decorator.types";
import { TenantGuard } from "../../../../../common/middleware/tenant-context.guard";
import { IncidentsService } from "../application/incidents.service";

@Controller("projects/:projectId/incidents")
@UseGuards(TenantGuard)
export class IncidentsController {
  constructor(private readonly service: IncidentsService) {}

  @Get()
  async getIncidents(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.service.getIncidents(
      org.orgId,
      projectId,
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
    );
  }

  @Get("stats")
  async getIncidentStats(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.service.getIncidentStats(org.orgId, projectId);
  }

  @Post(":id/acknowledge")
  async acknowledgeIncident(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser | null,
    @Body() body: { note?: string },
  ) {
    return this.service.acknowledgeIncident({ orgId: org.orgId, projectId }, id, actorLabel(user), body?.note);
  }

  @Post(":id/resolve")
  async resolveIncident(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser | null,
    @Body() body: { note?: string },
  ) {
    return this.service.resolveIncident({ orgId: org.orgId, projectId }, id, actorLabel(user), body?.note);
  }
}
