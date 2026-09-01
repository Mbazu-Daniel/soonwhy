import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';

@UseGuards(TenantGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  async createProject(
    @CurrentOrg() org: OrgContext,
    @Body() body: unknown,
  ) {
    const input = CreateProjectDto.parse(body);
    return this.projectsService.createProject(org.orgId, input);
  }

  @Get()
  async getProjectsForOrg(@CurrentOrg() org: OrgContext) {
    return this.projectsService.getProjectsForOrg(org.orgId);
  }

  @Get(':id')
  async getProjectById(@Param('id') id: string) {
    return this.projectsService.getProjectById(id);
  }

  @Put(':id')
  async updateProject(@Param('id') id: string, @Body() body: unknown) {
    const input = UpdateProjectDto.parse(body);
    return this.projectsService.updateProject(id, input);
  }

  @Delete(':id')
  async deleteProject(@Param('id') id: string) {
    return this.projectsService.deleteProject(id);
  }
}
