import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ApiKeysService } from "./api-keys.service";

function build(overrides: Record<string, unknown> = {}) {
  const repository = {
    getApiKeysByProjectId: vi.fn().mockResolvedValue([]),
    getProject: vi.fn().mockResolvedValue({ id: "p1" }),
    getApiKeyById: vi.fn().mockResolvedValue({ id: "k1", projectId: "p1", serviceAccountId: null }),
    createApiKey: vi.fn().mockResolvedValue({ id: "k1", key: "soonwhy_secret" }),
    deleteApiKey: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { repository, service: new ApiKeysService(repository as never) };
}

describe("ApiKeysService", () => {
  it("lists keys for a project within the organization", async () => {
    const { service, repository } = build();
    await service.getApiKeysForProject("p1", "o1");
    expect(repository.getApiKeysByProjectId).toHaveBeenCalledWith("p1", "o1");
  });

  it("refuses to create a key in a project of another organization", async () => {
    const { service, repository } = build({ getProject: vi.fn().mockResolvedValue(undefined) });
    await expect(service.createApiKey("p1", "o2", { name: "ci", scopes: [] })).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.getProject).toHaveBeenCalledWith("p1", "o2");
    expect(repository.createApiKey).not.toHaveBeenCalled();
  });

  it("creates a key with the given scopes and expiry", async () => {
    const { service, repository } = build();
    await service.createApiKey("p1", "o1", { name: "ci", scopes: ["ingest"], expiresAt: "2027-01-01T00:00:00.000Z" });
    expect(repository.createApiKey).toHaveBeenCalledWith({ projectId: "p1", name: "ci", scopes: ["ingest"], expiresAt: new Date("2027-01-01T00:00:00.000Z") });
  });

  it("creates a key with no scopes and no expiry when none are given", async () => {
    const { service, repository } = build();
    await service.createApiKey("p1", "o1", { name: "ci" } as never);
    expect(repository.createApiKey).toHaveBeenCalledWith({ projectId: "p1", name: "ci", scopes: [], expiresAt: undefined });
  });

  it("returns the secret only from the create call", async () => {
    const { service } = build();
    await expect(service.createApiKey("p1", "o1", { name: "ci", scopes: [] })).resolves.toMatchObject({ key: "soonwhy_secret" });
  });

  it("refuses to delete a key outside the organization", async () => {
    const { service, repository } = build({ getApiKeyById: vi.fn().mockResolvedValue(undefined) });
    await expect(service.deleteApiKey("k1", "o2", "p1", "member")).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.getApiKeyById).toHaveBeenCalledWith("k1", "o2");
    expect(repository.deleteApiKey).not.toHaveBeenCalled();
  });

  it("deletes a key inside the organization", async () => {
    const { service, repository } = build();
    await service.deleteApiKey("k1", "o1", "p1", "member");
    expect(repository.deleteApiKey).toHaveBeenCalledWith("k1", "o1");
  });

  it("refuses to delete a key that belongs to another project of the organization", async () => {
    const { service, repository } = build();
    await expect(service.deleteApiKey("k1", "o1", "p2", "member")).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.deleteApiKey).not.toHaveBeenCalled();
  });

  it("keeps service account keys away from plain members", async () => {
    const { service, repository } = build({ getApiKeyById: vi.fn().mockResolvedValue({ id: "k1", projectId: "p1", serviceAccountId: "sa1" }) });
    await expect(service.deleteApiKey("k1", "o1", "p1", "member")).rejects.toBeInstanceOf(ForbiddenException);
    await service.deleteApiKey("k1", "o1", "p1", "admin");
    expect(repository.deleteApiKey).toHaveBeenCalledOnce();
  });
});
