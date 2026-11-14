import { describe, expect, it, vi } from "vitest";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { ServicesService } from "./services.service";

describe("ServicesService", () => {
  const repository = {
    getServiceById: vi.fn(),
    getServicesByProjectId: vi.fn(),
    getServiceByProjectAndSlug: vi.fn(),
    createService: vi.fn(),
    deleteService: vi.fn(),
    updateService: vi.fn(),
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

  it("updates only the supplied fields and allows clearing one", async () => {
    repository.getServiceById.mockResolvedValue({ id: "service-1" });
    const service = new ServicesService(repository as never, quickwit as never);
    await service.updateService("service-1", "project-1", "org-1", {
      language: "TypeScript",
      framework: null,
      teamId: undefined,
    });
    expect(repository.updateService).toHaveBeenCalledWith("service-1", {
      language: "TypeScript",
      framework: null,
    });
  });

  it("does not update a service outside the tenant", async () => {
    repository.updateService.mockClear();
    repository.getServiceById.mockResolvedValue(undefined);
    const service = new ServicesService(repository as never, quickwit as never);
    await expect(
      service.updateService("service-1", "project-1", "other-org", { language: "Go" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.updateService).not.toHaveBeenCalled();
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

  it("keeps two telemetry names whose slugs collide", async () => {
    const search = vi.fn().mockResolvedValueOnce({
      aggregations: { services: { buckets: [{ key: "payments.prod" }, { key: "payments_prod" }] } },
    }).mockResolvedValue({ aggregations: { services: { buckets: [] } } });
    repository.getServicesByProjectId.mockResolvedValue([]);
    repository.createService.mockClear();
    const service = new ServicesService(repository as never, { search } as never);
    await service.getServicesForProject("project-collide", "org-1");
    const slugs = repository.createService.mock.calls.map((call) => (call[0] as { slug: string }).slug);
    expect(slugs).toEqual(["payments-prod", "payments-prod-2"]);
  });

  it("registers from the indexes that answered when one fails", async () => {
    const search = vi.fn().mockImplementation(async (index: string) => {
      if (index.includes("trace")) throw new Error("traces down");
      return { aggregations: { services: { buckets: index.includes("log") ? [{ key: "worker" }] : [] } } };
    });
    repository.getServicesByProjectId.mockResolvedValue([]);
    repository.createService.mockClear();
    const service = new ServicesService(repository as never, { search } as never);
    await service.getServicesForProject("project-partial", "org-1");
    expect(repository.createService).toHaveBeenCalledWith(expect.objectContaining({ name: "worker" }));
  });

  it("does not retry immediately after a failed sync", async () => {
    const search = vi.fn().mockRejectedValue(new Error("down"));
    repository.getServicesByProjectId.mockResolvedValue([]);
    const service = new ServicesService(repository as never, { search } as never);
    await service.getServicesForProject("project-backoff", "org-1");
    const calls = search.mock.calls.length;
    await service.getServicesForProject("project-backoff", "org-1");
    expect(search.mock.calls.length).toBe(calls);
  });

  it("keeps asking for names it has not seen when the first page is full", async () => {
    const full = Array.from({ length: 200 }, (_, n) => ({ key: `svc-${n}` }));
    const search = vi.fn()
      .mockResolvedValueOnce({ aggregations: { services: { buckets: full } } })
      .mockResolvedValueOnce({ aggregations: { services: { buckets: [] } } })
      .mockResolvedValueOnce({ aggregations: { services: { buckets: [] } } })
      .mockResolvedValueOnce({ aggregations: { services: { buckets: [{ key: "late-service" }] } } })
      .mockResolvedValue({ aggregations: { services: { buckets: [] } } });
    repository.getServicesByProjectId.mockResolvedValue([]);
    repository.createService.mockClear();
    const service = new ServicesService(repository as never, { search } as never);
    await service.getServicesForProject("project-many", "org-1");
    expect(repository.createService).toHaveBeenCalledWith(expect.objectContaining({ name: "late-service" }));
  });
});
