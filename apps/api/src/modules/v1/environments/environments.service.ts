import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { EnvironmentsRepository } from './environments.repository';
import { CreateEnvironmentInput } from './dto';

@Injectable()
export class EnvironmentsService {
  constructor(private readonly environmentsRepository: EnvironmentsRepository) {}

  async getEnvironmentById(id: string) {
    const env = await this.environmentsRepository.findEnvironmentById(id);
    if (!env) throw new NotFoundException('Environment not found');
    return env;
  }

  async getEnvironmentsForProject(projectId: string) {
    return this.environmentsRepository.findEnvironmentsByProjectId(projectId);
  }

  async createEnvironment(projectId: string, input: CreateEnvironmentInput) {
    const existing = await this.environmentsRepository.findEnvironmentByProjectAndSlug(
      projectId,
      input.slug,
    );
    if (existing) throw new ConflictException('Environment slug already exists in this project');
    return this.environmentsRepository.createEnvironment({ projectId, ...input });
  }

  async deleteEnvironment(id: string) {
    const env = await this.environmentsRepository.findEnvironmentById(id);
    if (!env) throw new NotFoundException('Environment not found');
    return this.environmentsRepository.deleteEnvironment(id);
  }
}
