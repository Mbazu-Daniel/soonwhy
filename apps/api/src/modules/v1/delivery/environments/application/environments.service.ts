import { ConflictException, Injectable } from "@nestjs/common";
import { EnvironmentsRepository } from "../infrastructure/environments.repository";
import type { CreateEnvironmentInput } from "../domain/dto/create-environment.dto";

@Injectable()
export class EnvironmentsService {
  constructor(private readonly repository: EnvironmentsRepository) {}

  async list(projectId: string, orgId: string) {
    const rows = await this.repository.list(projectId, orgId);
    return rows.map(({ environment }) => environment);
  }

  async create(
    projectId: string,
    orgId: string,
    input: CreateEnvironmentInput,
  ) {
    if (await this.repository.findBySlug(projectId, orgId, input.slug)) {
      throw new ConflictException(
        "Environment slug already exists in this project",
      );
    }
    const environment = await this.repository.create(projectId, input);
    if (!environment) {
      throw new ConflictException(
        "Environment slug already exists in this project",
      );
    }
    return environment;
  }
}
