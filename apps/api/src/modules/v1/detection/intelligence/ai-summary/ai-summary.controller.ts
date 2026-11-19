import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CurrentOrg,
  type OrgContext,
} from "../../../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../../../common/middleware/tenant-context.guard";
import { AiSummaryService } from "./ai-summary.service";

@ApiTags("intelligence")
@ApiBearerAuth()
@Controller("intelligence/summary")
@UseGuards(TenantGuard)
export class AiSummaryController {
  constructor(private readonly summary: AiSummaryService) {}

  @Get()
  @ApiOperation({ summary: "Project AI summary tile data" })
  async get(
    @CurrentOrg() org: OrgContext,
    @Query("projectId") projectId?: string,
    @Query("refresh") refresh?: string,
  ) {
    if (!projectId) {
      throw new BadRequestException("projectId is required");
    }
    return this.summary.get(org.orgId, projectId, {
      refresh: refresh === "1" || refresh === "true",
    });
  }
}
