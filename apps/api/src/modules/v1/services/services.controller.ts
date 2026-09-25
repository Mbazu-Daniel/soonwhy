import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';

@UseGuards(TenantGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  async createService(
    @CurrentOrg() org: OrgContext,
    @Body() body: unknown,
    @Query('projectId') projectId: string,
  ) {
    const input = CreateServiceDto.parse(body);
    return this.servicesService.createService(projectId, org.orgId, input);
  }

  @Get('map')
  async getServiceMap(@CurrentOrg() org: OrgContext, @Query('projectId') projectId: string) {
    return this.servicesService.getServiceMap(projectId, org.orgId);
  }

  @Get()
  async getServicesForProject(
    @CurrentOrg() org: OrgContext,
    @Query('projectId') projectId: string,
  ) {
    return this.servicesService.getServicesForProject(projectId, org.orgId);
  }

  @Get(':id')
  async getServiceById(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.servicesService.getServiceById(id, org.orgId);
  }

  @Delete(':id')
  async deleteService(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.servicesService.deleteService(id, org.orgId);
  }
}
