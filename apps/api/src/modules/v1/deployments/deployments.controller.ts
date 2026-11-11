import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Idempotent } from "@nestjs/idempotency";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";
import {
  CreateDeploymentDto,
  type CreateDeploymentInput,
} from "./dto/create-deployment.dto";
import { DeploymentsService } from "./deployments.service";

@UseGuards(TenantGuard)
@ApiTags("deployments")
@ApiBearerAuth()
@Controller("deployments")
export class DeploymentsController {
  constructor(private readonly service: DeploymentsService) {}

  @ApiOperation({
    summary: "List deployments",
    description: "Returns deployments for a service. Pass serviceId as a query parameter.",
  })
  @Get()
  list(@CurrentOrg() org: OrgContext, @Query("serviceId") serviceId: string) {
    return this.service.list(serviceId, org.orgId);
  }

  @ApiOperation({
    summary: "Record a deployment",
    description:
      "Creates the deployment marker detectors correlate against. serviceId and environmentId must belong to the organization.",
  })
  @Post()
  @Idempotent({
    ttl: 86400,
  })
  create(
    @CurrentOrg() org: OrgContext,
    @Body({ schema: CreateDeploymentDto }) body: CreateDeploymentInput,
  ) {
    return this.service.create(org.orgId, body);
  }
}
