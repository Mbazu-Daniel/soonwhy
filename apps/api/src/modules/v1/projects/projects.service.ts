import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectsRepository } from './projects.repository';
import { CreateProjectInput, UpdateProjectInput } from './dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly projectsRepository: ProjectsRepository) {}

  async getProjectById(id: string, orgId: string) {
    const project = await this.projectsRepository.getProjectById(id, orgId);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async getProjectsForOrg(orgId: string) {
    return this.projectsRepository.getProjectsByOrgId(orgId);
  }

  async createProject(orgId: string, input: CreateProjectInput) {
    const existing = await this.projectsRepository.getProjectByOrgAndSlug(orgId, input.slug);
    if (existing) throw new ConflictException('Project slug already exists in this organization');
    return this.projectsRepository.createProject({ orgId, ...input });
  }

  async updateProject(id: string, orgId: string, input: UpdateProjectInput) {
    await this.getProjectById(id, orgId);
    return this.projectsRepository.updateProject(id, orgId, input);
  }

  async deleteProject(id: string, orgId: string) {
    await this.getProjectById(id, orgId);
    return this.projectsRepository.deleteProject(id, orgId);
  }
}
