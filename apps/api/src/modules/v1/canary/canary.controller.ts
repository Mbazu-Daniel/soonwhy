import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
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
  runCanary(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("canaryId", ParseIntPipe) canaryId: number,
  ) {
    return this.service.runCanary({ orgId: org.orgId, projectId }, canaryId);
  }

  @Get(":canaryId")
  getCanary(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
    @Param("canaryId", ParseIntPipe) canaryId: number,
  ) {
    return this.service.getCanary({ orgId: org.orgId, projectId }, canaryId);
  }

  @Get()
  getCanaries(
    @CurrentOrg() org: OrgContext,
    @Param("projectId") projectId: string,
  ) {
    return this.service.getCanaries(org.orgId, projectId);
  }
}
