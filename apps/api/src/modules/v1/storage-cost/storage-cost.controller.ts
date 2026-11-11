import {
  Controller,
  Get,
  Param,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { StorageCostMonitoringService } from "./storage-cost.service";

@Controller("projects/:projectId/storage-cost")
@UseGuards(TenantGuard)
export class StorageCostController {
  constructor(private readonly service: StorageCostMonitoringService) {}

  @Get()
  async getStorageCosts(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.service.getStorageCosts(org.orgId, projectId);
  }

  @Get("recommendations")
  async getCostRecommendations(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.service.getCostRecommendations(org.orgId, projectId);
  }
}
