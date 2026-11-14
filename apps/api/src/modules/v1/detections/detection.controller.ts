import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { DetectionService } from "./detection.service";
import { listDetectionRuns } from "./detection.run";
import { ErrorsService } from "../errors";

@UseGuards(TenantGuard)
@ApiTags("detections")
@ApiBearerAuth()
@Controller("projects/:projectId/detections")
export class DetectionController {
  constructor(
    private readonly detectionService: DetectionService,
    private readonly errorsService: ErrorsService,
  ) {}

  @Post("run")
  async run(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.detectionService.run(org.orgId, projectId);
  }

  @Post("run/async")
  async enqueue(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.detectionService.enqueue(org.orgId, projectId);
  }

  @Get("telemetry")
  async telemetry(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.detectionService.telemetry(org.orgId, projectId);
  }

  @Get("runs")
  async runs(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return listDetectionRuns(org.orgId, projectId);
  }

  @Post("from-error")
  async createFromError(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body() body: { fingerprint?: string; from?: string; to?: string },
  ) {
    if (!body.fingerprint) throw new BadRequestException("fingerprint is required");
    return this.errorsService.createFinding(org.orgId, projectId, body.fingerprint, {
      from: body.from,
      to: body.to,
    });
  }

  @Get()
  async list(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.detectionService.list(org.orgId, projectId);
  }
}
