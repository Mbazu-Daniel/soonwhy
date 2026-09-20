import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { EnvironmentsService } from './environments.service';
import { CreateEnvironmentDto } from './dto';

@Controller('environments')
export class EnvironmentsController {
  constructor(private readonly environmentsService: EnvironmentsService) {}

  @Post()
  async createEnvironment(@Body() body: unknown, @Query('projectId') projectId: string) {
    const input = CreateEnvironmentDto.parse(body);
    return this.environmentsService.createEnvironment(projectId, input);
  }

  @Get()
  async getEnvironmentsForProject(@Query('projectId') projectId: string) {
    return this.environmentsService.getEnvironmentsForProject(projectId);
  }

  @Get(':id')
  async getEnvironmentById(@Param('id') id: string) {
    return this.environmentsService.getEnvironmentById(id);
  }

  @Delete(':id')
  async deleteEnvironment(@Param('id') id: string) {
    return this.environmentsService.deleteEnvironment(id);
  }
}
