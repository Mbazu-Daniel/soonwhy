import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CreateServiceAccountKeyDto } from "./service-accounts.dto";
import { ServiceAccountsService } from "./service-accounts.service";

function build(overrides: Record<string, unknown> = {}) {
  const accounts = {
    create: vi.fn().mockResolvedValue({ id: "sa1" }),
    find: vi.fn().mockResolvedValue({ id: "sa1" }),
    projectIds: vi.fn().mockResolvedValue(["p1"]),
    setDisabled: vi.fn().mockResolvedValue({ id: "sa1" }),
    remove: vi.fn().mockResolvedValue(true),
    keys: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
  const keys = { createApiKey: vi.fn().mockResolvedValue({ id: "k1", key: "soonwhy_x" }) };
  return { accounts, keys, service: new ServiceAccountsService(accounts as never, keys as never) };
}

describe("ServiceAccountsService", () => {
  it("rejects a duplicate name", async () => {
    const { service } = build({ create: vi.fn().mockResolvedValue(undefined) });
    await expect(service.create("o1", "u1", { name: "ci" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("creates a key owned by the service account in a project of the same organization", async () => {
    const { service, keys, accounts } = build();
    await service.createKey("o1", "sa1", { projectId: "p1", name: "deploy", scopes: ["ingest"] });
    expect(accounts.projectIds).toHaveBeenCalledWith("o1", ["p1"]);
    expect(keys.createApiKey).toHaveBeenCalledWith(expect.objectContaining({ projectId: "p1", serviceAccountId: "sa1", scopes: ["ingest"] }));
  });

  it("refuses a project from another organization", async () => {
    const { service, keys } = build({ projectIds: vi.fn().mockResolvedValue([]) });
    await expect(service.createKey("o1", "sa1", { projectId: "other", name: "k", scopes: [] })).rejects.toBeInstanceOf(NotFoundException);
    expect(keys.createApiKey).not.toHaveBeenCalled();
  });

  it("refuses a service account from another organization", async () => {
    const { service, keys } = build({ find: vi.fn().mockResolvedValue(undefined) });
    await expect(service.createKey("o2", "sa1", { projectId: "p1", name: "k", scopes: [] })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.listKeys("o2", "sa1")).rejects.toBeInstanceOf(NotFoundException);
    expect(keys.createApiKey).not.toHaveBeenCalled();
  });

  it("reports a missing account on disable and delete", async () => {
    const { service } = build({ setDisabled: vi.fn().mockResolvedValue(undefined), remove: vi.fn().mockResolvedValue(false) });
    await expect(service.setDisabled("o1", "x", true)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove("o1", "x")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("CreateServiceAccountKeyDto", () => {
  it("requires a project and defaults scopes", () => {
    expect(CreateServiceAccountKeyDto.safeParse({ name: "k" }).success).toBe(false);
    expect(CreateServiceAccountKeyDto.parse({ projectId: "p", name: "k" }).scopes).toEqual([]);
  });
});
