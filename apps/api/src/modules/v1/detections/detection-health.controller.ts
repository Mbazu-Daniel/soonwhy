import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { OwnerOrAdminGuard } from "../../../common/guards/owner-or-admin.guard";
import { getDetectionHealth } from "./detection-health";

@ApiTags("detections")
@ApiBearerAuth()
@UseGuards(TenantGuard, OwnerOrAdminGuard)
@Controller("detections")
export class DetectionHealthController {
  @ApiOperation({
    summary: "Detector execution health (org, last 24h)",
    description:
      "Aggregates the organisation's detection runs: totals (runs, success rate, failures, average/max duration, findings), the most recent run, and the 10 most recent runs.",
  })
  @Get("health")
  health(@CurrentOrg() org: OrgContext) {
    return getDetectionHealth(org.orgId);
  }
}
