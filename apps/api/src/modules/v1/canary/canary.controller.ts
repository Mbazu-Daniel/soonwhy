import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import { CanaryService } from "./canary.service";

@UseGuards(TenantGuard)
@Controller("projects/:projectId/canary")
export class CanaryController {
  constructor(private readonly service: CanaryService) {}

  @Post()
  createCanary(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Body() body: any,
  ) {
    return this.service.createCanary({
      orgId: org.orgId,
      projectId,
      deploymentId: body.deploymentId,
      name: body.name,
      targetUrl: body.targetUrl,
      baselineUrl: body.baselineUrl,
      validationRules: body.validationRules,
    });
  }

  @Post(":canaryId/run")
  runCanary(@Param("canaryId") canaryId: string) {
    return this.service.runCanary(Number(canaryId));
  }

  @Get(":canaryId")
  getCanary(@Param("canaryId") canaryId: string) {
    return this.service.getCanary(Number(canaryId));
  }

  @Get()
  getCanaries(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.service.getCanaries(org.orgId, projectId);
  }
}
