import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
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
    @Param("fingerprint") fingerprint: string,
    @Body() body: { resolvedBy: string },
  ) {
    return this.service.markAsResolved(fingerprint, body.resolvedBy);
  }

  @Post(":id/notified")
  async markNotified(@Param("id") id: string) {
    await this.service.markRegressionNotified(Number(id));
    return { message: "Marked as notified" };
  }
}
