import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { HistoricalAnalysisService } from "./historical-analysis.service";

@Controller("projects/:projectId/historical-analysis")
@UseGuards(TenantGuard)
export class HistoricalAnalysisController {
  constructor(private readonly service: HistoricalAnalysisService) {}

  @Get("compare")
  async compareTimePeriods(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("service") service: string,
    @Query("currentFrom") currentFrom: string,
    @Query("currentTo") currentTo: string,
    @Query("previousFrom") previousFrom: string,
    @Query("previousTo") previousTo: string,
  ) {
    return this.service.compareTimePeriods(
      org.orgId,
      projectId,
      service,
      currentFrom,
      currentTo,
      previousFrom,
      previousTo,
    );
  }

  @Get("trends")
  async getTrendAnalysis(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("service") service: string,
    @Query("daysBack") daysBack?: string,
    @Query("interval") interval?: string,
  ) {
    return this.service.getTrendAnalysis(
      org.orgId,
      projectId,
      service,
      daysBack ? Number(daysBack) : 30,
      interval || "1d",
    );
  }

  @Get("compare-deployments")
  async compareDeployments(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Query("service") service: string,
    @Query("beforeDeploymentId") beforeDeploymentId: string,
    @Query("afterDeploymentId") afterDeploymentId: string,
    @Query("windowMinutes") windowMinutes?: string,
  ) {
    return this.service.compareDeployments(
      org.orgId,
      projectId,
      service,
      beforeDeploymentId,
      afterDeploymentId,
      windowMinutes ? Number(windowMinutes) : 60,
    );
  }
}
