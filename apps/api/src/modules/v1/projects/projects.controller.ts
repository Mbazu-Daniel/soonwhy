import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, UpdateProjectSettingsDto } from './dto';
import { CurrentOrg, OrgContext } from '../../../common/decorators/current-org.decorator';
import { TenantGuard } from '../../../common/middleware/tenant-context.guard';

@UseGuards(TenantGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  async createProject(@CurrentOrg() org: OrgContext, @Body() body: unknown) {
    const input = CreateProjectDto.parse(body);
    return this.projectsService.createProject(org.orgId, input);
  }

  @Get()
  async getProjectsForOrg(@CurrentOrg() org: OrgContext) {
    return this.projectsService.getProjectsForOrg(org.orgId);
  }

  @Get(':id/settings')
  async getProjectSettings(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.projectsService.getProjectSettings(id, org.orgId);
  }

  @Put(':id/settings')
  async updateProjectSettings(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = UpdateProjectSettingsDto.parse(body);
    return this.projectsService.updateProjectSettings(id, org.orgId, input);
  }

  @Get(':id')
  async getProjectById(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.projectsService.getProjectById(id, org.orgId);
  }

  @Put(':id')
  async updateProject(
    @CurrentOrg() org: OrgContext,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = UpdateProjectDto.parse(body);
    return this.projectsService.updateProject(id, org.orgId, input);
  }

  @Delete(':id')
  async deleteProject(@CurrentOrg() org: OrgContext, @Param('id') id: string) {
    return this.projectsService.deleteProject(id, org.orgId);
  }
}
