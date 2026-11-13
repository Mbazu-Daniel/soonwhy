import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ProjectsService } from "./projects.service";
import {
  CreateProjectDto,
  UpdateProjectDto,
  UpdateProjectSettingsDto,
  type CreateProjectInput,
  type UpdateProjectInput,
  type UpdateProjectSettingsInput,
} from "./dto";
import {
  CurrentOrg,
  OrgContext,
} from "../../../common/decorators/current-org.decorator";
import { TenantGuard } from "../../../common/middleware/tenant-context.guard";

function assertCanManageProjects(org: OrgContext): void {
  const roles = (org.userRole ?? "").split(",").map((role) => role.trim());
  if (!roles.some((role) => role === "owner" || role === "admin")) {
    throw new ForbiddenException("Only owners and admins can manage projects");
  }
}

@UseGuards(TenantGuard)
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  async createProject(
    @CurrentOrg() org: OrgContext,
    @Body({ schema: CreateProjectDto }) body: CreateProjectInput,
  ) {
    assertCanManageProjects(org);
    return this.projectsService.createProject(org.orgId, body);
  }

  @Get()
  async getProjectsForOrg(@CurrentOrg() org: OrgContext) {
    return this.projectsService.getProjectsForOrg(org.orgId);
  }

  @Get(":id/settings")
  async getProjectSettings(
    @CurrentOrg() org: OrgContext,
    @Param("id") id: string,
  ) {
    return this.projectsService.getProjectSettings(id, org.orgId);
  }

  @Put(":id/settings")
  async updateProjectSettings(
    @CurrentOrg() org: OrgContext,
    @Param("id") id: string,
    @Body({ schema: UpdateProjectSettingsDto }) body: UpdateProjectSettingsInput,
  ) {
    return this.projectsService.updateProjectSettings(id, org.orgId, body);
  }

  @Get(":id")
  async getProjectById(@CurrentOrg() org: OrgContext, @Param("id") id: string) {
    return this.projectsService.getProjectById(id, org.orgId);
  }

  @Put(":id")
  async updateProject(
    @CurrentOrg() org: OrgContext,
    @Param("id") id: string,
    @Body({ schema: UpdateProjectDto }) body: UpdateProjectInput,
  ) {
    assertCanManageProjects(org);
    return this.projectsService.updateProject(id, org.orgId, body);
  }

  @Delete(":id")
  async deleteProject(@CurrentOrg() org: OrgContext, @Param("id") id: string) {
    assertCanManageProjects(org);
    return this.projectsService.deleteProject(id, org.orgId);
  }
}
