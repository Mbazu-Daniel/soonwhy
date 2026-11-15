import { Injectable, NotFoundException } from "@nestjs/common";
import { ApiKeysRepository } from "./api-keys.repository";
import { CreateApiKeyInput } from "./dto";

@Injectable()
export class ApiKeysService {
  constructor(private readonly apiKeysRepository: ApiKeysRepository) {}

  async getApiKeysForProject(projectId: string, orgId: string) {
    return this.apiKeysRepository.getApiKeysByProjectId(projectId, orgId);
  }

  async createApiKey(
    projectId: string,
    orgId: string,
    input: CreateApiKeyInput,
  ) {
    const project = await this.apiKeysRepository.getProject(projectId, orgId);
    if (!project) throw new NotFoundException("Project not found");

    return this.apiKeysRepository.createApiKey({
      projectId,
      name: input.name,
      scopes: input.scopes ?? [],
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    });
  }

  async deleteApiKey(id: string, orgId: string) {
    const key = await this.apiKeysRepository.getApiKeyById(id, orgId);
    if (!key) throw new NotFoundException("API key not found");
    return this.apiKeysRepository.deleteApiKey(id);
  }
}
