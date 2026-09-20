import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  async createService(@Body() body: unknown, @Query('projectId') projectId: string) {
    const input = CreateServiceDto.parse(body);
    return this.servicesService.createService(projectId, input);
  }

  @Get()
  async getServicesForProject(@Query('projectId') projectId: string) {
    return this.servicesService.getServicesForProject(projectId);
  }

  @Get(':id')
  async getServiceById(@Param('id') id: string) {
    return this.servicesService.getServiceById(id);
  }

  @Delete(':id')
  async deleteService(@Param('id') id: string) {
    return this.servicesService.deleteService(id);
  }
}
