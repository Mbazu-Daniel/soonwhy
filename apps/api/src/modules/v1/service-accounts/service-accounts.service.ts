import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ApiKeysRepository } from "../api-keys/api-keys.repository";
import type { CreateServiceAccountInput, CreateServiceAccountKeyInput } from "./service-accounts.dto";
import { ServiceAccountsRepository } from "./service-accounts.repository";

@Injectable()
export class ServiceAccountsService {
  constructor(
    private readonly accounts: ServiceAccountsRepository,
    private readonly keys: ApiKeysRepository,
  ) {}

  list(orgId: string) {
    return this.accounts.list(orgId);
  }

  async create(orgId: string, createdBy: string | undefined, input: CreateServiceAccountInput) {
    const created = await this.accounts.create({ orgId, createdBy, ...input });
    if (!created) throw new ConflictException("A service account with that name already exists");
    return created;
  }

  async setDisabled(orgId: string, id: string, disabled: boolean) {
    const updated = await this.accounts.setDisabled(orgId, id, disabled);
    if (!updated) throw new NotFoundException("Service account not found");
    return updated;
  }

  async remove(orgId: string, id: string) {
    if (!(await this.accounts.remove(orgId, id))) throw new NotFoundException("Service account not found");
    return { deleted: true };
  }

  async listKeys(orgId: string, id: string) {
    await this.requireAccount(orgId, id);
    return this.accounts.keys(id);
  }

  async createKey(orgId: string, id: string, input: CreateServiceAccountKeyInput) {
    await this.requireAccount(orgId, id);
    const [projectId] = await this.accounts.projectIds(orgId, [input.projectId]);
    if (!projectId) throw new NotFoundException("Project not found");
    return this.keys.createApiKey({
      projectId,
      name: input.name,
      scopes: input.scopes,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      serviceAccountId: id,
    });
  }

  private async requireAccount(orgId: string, id: string) {
    const account = await this.accounts.find(orgId, id);
    if (!account) throw new NotFoundException("Service account not found");
    return account;
  }
}
