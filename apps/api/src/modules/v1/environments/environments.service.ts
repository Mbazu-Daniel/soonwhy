import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EnvironmentsRepository } from './environments.repository';
import type { CreateEnvironmentInput } from './dto/create-environment.dto';

@Injectable()
export class EnvironmentsService {
  constructor(private readonly repository: EnvironmentsRepository) {}

  async list(projectId: string, orgId: string) {
    const rows = await this.repository.list(projectId, orgId);
    return rows.map(({ environment }) => environment);
  }

  async create(projectId: string, orgId: string, input: CreateEnvironmentInput) {
    if (!(await this.repository.projectBelongsToOrg(projectId, orgId))) {
      throw new BadRequestException('Project does not belong to the current organization');
    }

    if (await this.repository.findBySlug(projectId, orgId, input.slug)) {
      throw new ConflictException('Environment slug already exists in this project');
    }
    return this.repository.create(projectId, input);
  }
}
