import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { KEY_ADMIN_ROLES } from "../domain/api-keys.constants";
import { ApiKeysRepository } from "../infrastructure/api-keys.repository";
import { CreateApiKeyInput } from "../domain/dto";

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

  async deleteApiKey(id: string, orgId: string, projectId: string, role: string) {
    const key = await this.apiKeysRepository.getApiKeyById(id, orgId);
    if (!key || key.projectId !== projectId) throw new NotFoundException("API key not found");
    if (key.serviceAccountId && !KEY_ADMIN_ROLES.has(role)) {
      throw new ForbiddenException("Only owners and admins can delete service account keys");
    }
    return this.apiKeysRepository.deleteApiKey(id, orgId);
  }
}
