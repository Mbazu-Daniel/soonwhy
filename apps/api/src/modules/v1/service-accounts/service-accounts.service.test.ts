import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CreateServiceAccountDto, CreateServiceAccountKeyDto, UpdateServiceAccountDto } from "./service-accounts.dto";
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

describe("ServiceAccountsService details", () => {
  it("records who created the account", async () => {
    const { service, accounts } = build();
    await service.create("o1", "u1", { name: "ci", description: "deploys" });
    expect(accounts.create).toHaveBeenCalledWith({ orgId: "o1", createdBy: "u1", name: "ci", description: "deploys" });
  });

  it("lists accounts and keys of the organization", async () => {
    const { service, accounts } = build({ list: vi.fn().mockResolvedValue([{ id: "sa1" }]) });
    await expect(service.list("o1")).resolves.toEqual([{ id: "sa1" }]);
    await service.listKeys("o1", "sa1");
    expect(accounts.find).toHaveBeenCalledWith("o1", "sa1");
    expect(accounts.keys).toHaveBeenCalledWith("sa1");
  });

  it("converts the expiry of a key to a date", async () => {
    const { service, keys } = build();
    await service.createKey("o1", "sa1", { projectId: "p1", name: "deploy", scopes: [], expiresAt: "2027-01-01T00:00:00.000Z" });
    expect(keys.createApiKey).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: new Date("2027-01-01T00:00:00.000Z") }));
  });

  it("returns the disabled and deleted results", async () => {
    const { service } = build();
    await expect(service.setDisabled("o1", "sa1", true)).resolves.toEqual({ id: "sa1" });
    await expect(service.remove("o1", "sa1")).resolves.toEqual({ deleted: true });
  });
});

describe("CreateServiceAccountKeyDto", () => {
  it("requires a project and defaults scopes", () => {
    expect(CreateServiceAccountKeyDto.safeParse({ name: "k" }).success).toBe(false);
    expect(CreateServiceAccountKeyDto.parse({ projectId: "p", name: "k" }).scopes).toEqual([]);
  });
});

describe("service account request bodies", () => {
  it("trims the name and refuses an empty or oversized one", () => {
    expect(CreateServiceAccountDto.parse({ name: "  ci  " }).name).toBe("ci");
    expect(CreateServiceAccountDto.safeParse({ name: "   " }).success).toBe(false);
    expect(CreateServiceAccountDto.safeParse({ name: "x".repeat(101) }).success).toBe(false);
    expect(CreateServiceAccountDto.safeParse({ name: "ci", description: "x".repeat(501) }).success).toBe(false);
  });

  it("requires a boolean to disable an account", () => {
    expect(UpdateServiceAccountDto.safeParse({ disabled: true }).success).toBe(true);
    expect(UpdateServiceAccountDto.safeParse({ disabled: "yes" }).success).toBe(false);
    expect(UpdateServiceAccountDto.safeParse({}).success).toBe(false);
  });

  it("refuses a key with a bad expiry, too many scopes or an empty scope", () => {
    const base = { projectId: "p", name: "k" };
    expect(CreateServiceAccountKeyDto.safeParse({ ...base, expiresAt: "tomorrow" }).success).toBe(false);
    expect(CreateServiceAccountKeyDto.safeParse({ ...base, scopes: Array.from({ length: 21 }, (_, index) => `s${index}`) }).success).toBe(false);
    expect(CreateServiceAccountKeyDto.safeParse({ ...base, scopes: [""] }).success).toBe(false);
    expect(CreateServiceAccountKeyDto.safeParse({ ...base, expiresAt: "2027-01-01T00:00:00.000Z" }).success).toBe(true);
  });
});
