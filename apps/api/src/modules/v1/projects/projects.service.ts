import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ProjectsRepository } from './projects.repository';
import { CreateProjectInput, UpdateProjectInput } from './dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly projectsRepository: ProjectsRepository) {}

  async getProjectById(id: string) {
    const project = await this.projectsRepository.findProjectById(id);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async getProjectsForOrg(orgId: string) {
    return this.projectsRepository.findProjectsByOrgId(orgId);
  }

  async createProject(orgId: string, input: CreateProjectInput) {
    const existing = await this.projectsRepository.findProjectByOrgAndSlug(orgId, input.slug);
    if (existing) throw new ConflictException('Project slug already exists in this organization');
    return this.projectsRepository.createProject({ orgId, ...input });
  }

  async updateProject(id: string, input: UpdateProjectInput) {
    const project = await this.projectsRepository.findProjectById(id);
    if (!project) throw new NotFoundException('Project not found');
    return this.projectsRepository.updateProject(id, input);
  }

  async deleteProject(id: string) {
    const project = await this.projectsRepository.findProjectById(id);
    if (!project) throw new NotFoundException('Project not found');
    return this.projectsRepository.deleteProject(id);
  }
}
