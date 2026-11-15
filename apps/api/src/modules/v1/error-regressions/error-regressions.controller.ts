import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { actorLabel, AuthUser, CurrentUser } from "../../../common/decorators/current-user.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { ErrorRegressionsService } from "./error-regressions.service";

@Controller("projects/:projectId/error-regressions")
@UseGuards(TenantGuard)
export class ErrorRegressionsController {
  constructor(private readonly service: ErrorRegressionsService) {}

  @Get("regressions")
  async getRegressions(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.service.getRegressions(
      org.orgId,
      projectId,
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
    );
  }

  @Get("recent")
  async getRecentErrors(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("hoursAgo") hoursAgo?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.getRecentErrors(
      org.orgId,
      projectId,
      hoursAgo ? Number(hoursAgo) : 24,
      limit ? Number(limit) : 100,
    );
  }

  @Post(":fingerprint/resolve")
  async markAsResolved(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("fingerprint") fingerprint: string,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.service.markAsResolved(org.orgId, projectId, fingerprint, actorLabel(user));
  }

  @Post(":id/notified")
  async markNotified(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id", ParseIntPipe) id: number,
  ) {
    await this.service.markRegressionNotified(org.orgId, projectId, id);
    return { message: "Marked as notified" };
  }
}
