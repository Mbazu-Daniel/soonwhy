import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';
import { CreateEnvironmentDto } from './dto/create-environment.dto';
import { EnvironmentsService } from './environments.service';

@UseGuards(TenantGuard)
@Controller('projects/:projectId/environments')
export class EnvironmentsController {
  constructor(private readonly service: EnvironmentsService) {}

  @Get()
  list(@CurrentOrg() org: OrgContext, @Param('projectId') projectId: string) {
    return this.service.list(projectId, org.orgId);
  }

  @Post()
  create(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    return this.service.create(projectId, org.orgId, CreateEnvironmentDto.parse(body));
  }
}
