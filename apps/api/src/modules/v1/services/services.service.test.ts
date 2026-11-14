import { describe, expect, it, vi } from "vitest";
import { ConflictException } from "@nestjs/common";
import { ServicesService } from "./services.service";

describe("ServicesService", () => {
  const repository = {
    getServiceById: vi.fn(),
    getServicesByProjectId: vi.fn(),
    getServiceByProjectAndSlug: vi.fn(),
    createService: vi.fn(),
    deleteService: vi.fn(),
  };
  const quickwit = { search: vi.fn() };

  it("requires the project and tenant when reading a service", async () => {
    repository.getServiceById.mockResolvedValue({
      id: "service-1",
      orgId: "org-1",
      projectId: "project-1",
    });
    const service = new ServicesService(repository as never, quickwit as never);
    await expect(
      service.getServiceById("service-1", "project-1", "org-1"),
    ).resolves.toMatchObject({ orgId: "org-1", projectId: "project-1" });
    expect(repository.getServiceById).toHaveBeenCalledWith(
      "service-1",
      "project-1",
      "org-1",
    );
  });

  it("rejects duplicate service slugs within a tenant project", async () => {
    repository.getServiceByProjectAndSlug.mockResolvedValue({ id: "existing" });
    const service = new ServicesService(repository as never, quickwit as never);
    await expect(
      service.createService("project-1", "org-1", { name: "API", slug: "api" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.createService).not.toHaveBeenCalled();
  });

  it("persists application metadata with the tenant context", async () => {
    repository.getServiceByProjectAndSlug.mockResolvedValue(undefined);
    repository.createService.mockResolvedValue({ id: "service-1" });
    const service = new ServicesService(repository as never, quickwit as never);
    await service.createService("project-1", "org-1", {
      name: "API",
      slug: "api",
      language: "TypeScript",
      framework: "NestJS",
      repositoryUrl: "https://github.com/example/api",
      repositoryProvider: "github",
      repositoryBranch: "main",
    });
    expect(repository.createService).toHaveBeenCalledWith({
      projectId: "project-1",
      orgId: "org-1",
      name: "API",
      slug: "api",
      language: "TypeScript",
      framework: "NestJS",
      repositoryUrl: "https://github.com/example/api",
      repositoryProvider: "github",
      repositoryBranch: "main",
    });
  });

  it("builds the service map from parent and child spans", async () => {
    quickwit.search.mockResolvedValue({
      hits: [
        { _source: { spanId: "root", service: "web" } },
        { _source: { spanId: "child", parentSpanId: "root", service: "api" } },
        { _source: { spanId: "child", parentSpanId: "root", service: "api" } },
      ],
    });
    const service = new ServicesService(repository as never, quickwit as never);
    await expect(service.getServiceMap("project-1", "org-1")).resolves.toEqual({
      nodes: [
        { service: "api", requests: 2 },
        { service: "web", requests: 1 },
      ],
      edges: [{ source: "web", target: "api", requests: 2 }],
    });
  });

  it("registers services seen in telemetry that have no row yet", async () => {
    const search = vi.fn().mockResolvedValue({
      aggregations: { services: { buckets: [{ key: "mivacampus-api" }, { key: "Billing API" }] } },
    });
    repository.getServicesByProjectId.mockResolvedValue([{ name: "mivacampus-api", slug: "mivacampus-api" }]);
    repository.createService.mockClear();
    const service = new ServicesService(repository as never, { search } as never);
    await service.getServicesForProject("project-sync", "org-1");
    expect(repository.createService).toHaveBeenCalledTimes(1);
    expect(repository.createService).toHaveBeenCalledWith({
      projectId: "project-sync",
      orgId: "org-1",
      name: "Billing API",
      slug: "billing-api",
    });
  });

  it("still lists services when telemetry cannot be read", async () => {
    const search = vi.fn().mockRejectedValue(new Error("quickwit down"));
    repository.getServicesByProjectId.mockResolvedValue([{ name: "api", slug: "api" }]);
    const service = new ServicesService(repository as never, { search } as never);
    await expect(service.getServicesForProject("project-down", "org-1")).resolves.toHaveLength(1);
  });
});
