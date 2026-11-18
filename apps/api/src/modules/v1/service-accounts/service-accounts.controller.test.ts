import { describe, expect, it, vi } from "vitest";
import { ServiceAccountsController } from "./service-accounts.controller";

const ORG = { orgId: "org-1", userRole: "admin" };

function build() {
  const service = {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: "sa1" }),
    setDisabled: vi.fn().mockResolvedValue({ id: "sa1" }),
    remove: vi.fn().mockResolvedValue({ deleted: true }),
    listKeys: vi.fn().mockResolvedValue([]),
    createKey: vi.fn().mockResolvedValue({ id: "k1" }),
  };
  return { service, controller: new ServiceAccountsController(service as never) };
}

describe("ServiceAccountsController", () => {
  it("passes the organization and the signed in user to every call", async () => {
    const { controller, service } = build();
    await controller.list(ORG);
    await controller.create(ORG, "user-1", { name: "ci" });
    await controller.update(ORG, "sa1", { disabled: true });
    await controller.remove(ORG, "sa1");
    await controller.keys(ORG, "sa1");
    await controller.createKey(ORG, "sa1", { projectId: "p1", name: "k", scopes: [] });
    expect(service.list).toHaveBeenCalledWith("org-1");
    expect(service.create).toHaveBeenCalledWith("org-1", "user-1", { name: "ci" });
    expect(service.setDisabled).toHaveBeenCalledWith("org-1", "sa1", true);
    expect(service.remove).toHaveBeenCalledWith("org-1", "sa1");
    expect(service.listKeys).toHaveBeenCalledWith("org-1", "sa1");
    expect(service.createKey).toHaveBeenCalledWith("org-1", "sa1", { projectId: "p1", name: "k", scopes: [] });
  });
});
