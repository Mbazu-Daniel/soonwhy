import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';
import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { DeploymentsService } from './deployments.service';

@UseGuards(TenantGuard)
@Controller('deployments')
export class DeploymentsController {
  constructor(private readonly service: DeploymentsService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext, @Query('serviceId') serviceId: string) {
    return this.service.list(serviceId, org.orgId);
  }

  @Post()
  create(@CurrentOrg() org: OrgContext, @Body() body: unknown) {
    return this.service.create(org.orgId, CreateDeploymentDto.parse(body));
  }
}
