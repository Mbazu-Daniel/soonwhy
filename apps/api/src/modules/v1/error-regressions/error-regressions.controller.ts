import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { CurrentUser, type AuthUser } from "../../../common/decorators/current-user.decorator";
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
    @CurrentUser() user: AuthUser | null,
    @Param("projectId") projectId: string,
    @Param("fingerprint") fingerprint: string,
  ) {
    if (!user) throw new UnauthorizedException("Sign in to resolve an error");
    return this.service.markAsResolved(org.orgId, projectId, fingerprint, user.id);
  }

  @Post(":id/notified")
  async markNotified(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("id") id: string,
  ) {
    await this.service.markRegressionNotified(org.orgId, projectId, Number(id));
    return { message: "Marked as notified" };
  }
}
