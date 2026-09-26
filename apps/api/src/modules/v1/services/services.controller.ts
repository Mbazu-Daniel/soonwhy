import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';

@UseGuards(TenantGuard)
@Controller('projects/:projectId/services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  async createService(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    const input = CreateServiceDto.parse(body);
    return this.servicesService.createService(projectId, org.orgId, input);
  }

  @Get()
  async getServicesForProject(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
  ) {
    return this.servicesService.getServicesForProject(projectId, org.orgId);
  }

  @Get(':id')
  async getServiceById(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.servicesService.getServiceById(id, projectId, org.orgId);
  }

  @Delete(':id')
  async deleteService(
    @CurrentOrg() org: OrgContext,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.servicesService.deleteService(id, projectId, org.orgId);
  }
}
