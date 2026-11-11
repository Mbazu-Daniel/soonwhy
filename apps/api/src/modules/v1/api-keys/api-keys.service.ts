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

  async validateKey(
    rawKey: string,
  ): Promise<{ projectId: string; orgId: string; scopes: string[] } | null> {
    const keyHash = this.apiKeysRepository.hash(rawKey);
    const result =
      await this.apiKeysRepository.getApiKeyWithProjectByHash(keyHash);
    if (!result) return null;
    const key = result.apiKey;
    if (key.expiresAt && key.expiresAt < new Date()) return null;
    await this.apiKeysRepository.updateLastUsedAt(key.id);
    return {
      projectId: key.projectId,
      orgId: result.organizationId,
      scopes: key.scopes || [],
    };
  }
}
