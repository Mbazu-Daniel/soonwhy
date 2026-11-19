import { describe, expect, it, vi } from "vitest";
import { ApiKeysController } from "./api-keys.controller";

const ORG = { orgId: "org-1", userRole: "member" };

function build() {
  const service = {
    createApiKey: vi.fn().mockResolvedValue({ id: "k1" }),
    getApiKeysForProject: vi.fn().mockResolvedValue([]),
    deleteApiKey: vi.fn().mockResolvedValue(undefined),
  };
  return { service, controller: new ApiKeysController(service as never) };
}

describe("ApiKeysController", () => {
  it("scopes every call to the caller's organization", async () => {
    const { controller, service } = build();
    await controller.createApiKey(ORG, "p1", { name: "ci", scopes: [] });
    await controller.getApiKeysForProject(ORG, "p1");
    await controller.deleteApiKey(ORG, "p1", "k1");
    expect(service.createApiKey).toHaveBeenCalledWith("p1", "org-1", { name: "ci", scopes: [] });
    expect(service.getApiKeysForProject).toHaveBeenCalledWith("p1", "org-1");
    expect(service.deleteApiKey).toHaveBeenCalledWith("k1", "org-1", "p1", "member");
  });
});
