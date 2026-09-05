import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiKeysRepository } from './api-keys.repository';
import { CreateApiKeyInput } from './dto';

@Injectable()
export class ApiKeysService {
  constructor(private readonly apiKeysRepository: ApiKeysRepository) {}

  async getApiKeyById(id: string) {
    const key = await this.apiKeysRepository.findApiKeyById(id);
    if (!key) throw new NotFoundException('API key not found');
    return key;
  }

  async getApiKeysForProject(projectId: string) {
    return this.apiKeysRepository.findApiKeysByProjectId(projectId);
  }

  async createApiKey(projectId: string, input: CreateApiKeyInput) {
    return this.apiKeysRepository.createApiKey({
      projectId,
      name: input.name,
      scopes: input.scopes ?? [],
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    });
  }

  async deleteApiKey(id: string) {
    const key = await this.apiKeysRepository.findApiKeyById(id);
    if (!key) throw new NotFoundException('API key not found');
    return this.apiKeysRepository.deleteApiKey(id);
  }

  async validateKey(rawKey: string): Promise<{ projectId: string; scopes: string[] } | null> {
    const keyHash = this.apiKeysRepository.hash(rawKey);
    const key = await this.apiKeysRepository.findApiKeyByHash(keyHash);
    if (!key) return null;
    if (key.expiresAt && key.expiresAt < new Date()) return null;
    await this.apiKeysRepository.updateLastUsedAt(key.id);
    return { projectId: key.projectId, scopes: key.scopes || [] };
  }
}
