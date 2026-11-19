import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ProjectsService } from "./projects.service";

function build(overrides: Record<string, unknown> = {}) {
  const repository = {
    getProjectById: vi.fn().mockResolvedValue({ id: "p1" }),
    getProjectsByOrgId: vi.fn().mockResolvedValue([{ id: "p1" }]),
    getProjectByOrgAndSlug: vi.fn().mockResolvedValue(undefined),
    createProject: vi.fn().mockResolvedValue({ id: "p2" }),
    updateProject: vi.fn().mockResolvedValue({ id: "p1" }),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    getProjectSettings: vi.fn().mockResolvedValue({ retentionDays: 30 }),
    updateProjectSettings: vi.fn().mockResolvedValue({ retentionDays: 7 }),
    ...overrides,
  };
  return { repository, service: new ProjectsService(repository as never) };
}

const MISSING = { getProjectById: vi.fn().mockResolvedValue(undefined) };

describe("ProjectsService", () => {
  it("reads a project only inside the organization", async () => {
    const { service, repository } = build();
    await expect(service.getProjectById("p1", "o1")).resolves.toEqual({ id: "p1" });
    expect(repository.getProjectById).toHaveBeenCalledWith("p1", "o1");
  });

  it("reports a project that is missing or in another organization as not found", async () => {
    const { service } = build(MISSING);
    await expect(service.getProjectById("p1", "o2")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lists the projects of the organization", async () => {
    const { service, repository } = build();
    await expect(service.getProjectsForOrg("o1")).resolves.toEqual([{ id: "p1" }]);
    expect(repository.getProjectsByOrgId).toHaveBeenCalledWith("o1");
  });

  it("creates a project in the organization", async () => {
    const { service, repository } = build();
    await service.createProject("o1", { name: "API", slug: "api" } as never);
    expect(repository.getProjectByOrgAndSlug).toHaveBeenCalledWith("o1", "api");
    expect(repository.createProject).toHaveBeenCalledWith({ organizationId: "o1", name: "API", slug: "api" });
  });

  it("refuses a slug the organization already uses", async () => {
    const { service, repository } = build({ getProjectByOrgAndSlug: vi.fn().mockResolvedValue({ id: "p9" }) });
    await expect(service.createProject("o1", { name: "API", slug: "api" } as never)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.createProject).not.toHaveBeenCalled();
  });

  it.each([
    ["updateProject", (service: ProjectsService) => service.updateProject("p1", "o2", { name: "x" } as never), "updateProject"],
    ["deleteProject", (service: ProjectsService) => service.deleteProject("p1", "o2"), "deleteProject"],
    ["getProjectSettings", (service: ProjectsService) => service.getProjectSettings("p1", "o2"), "getProjectSettings"],
    ["updateProjectSettings", (service: ProjectsService) => service.updateProjectSettings("p1", "o2", {} as never), "updateProjectSettings"],
  ])("%s does nothing for a project outside the organization", async (_name, run, repositoryMethod) => {
    const { service, repository } = build(MISSING);
    await expect(run(service)).rejects.toBeInstanceOf(NotFoundException);
    expect((repository as Record<string, ReturnType<typeof vi.fn>>)[repositoryMethod]).not.toHaveBeenCalled();
  });

  it("changes a project in the organization", async () => {
    const { service, repository } = build();
    await service.updateProject("p1", "o1", { name: "New" } as never);
    await service.deleteProject("p1", "o1");
    await service.updateProjectSettings("p1", "o1", { retentionDays: 7 } as never);
    expect(repository.updateProject).toHaveBeenCalledWith("p1", "o1", { name: "New" });
    expect(repository.deleteProject).toHaveBeenCalledWith("p1", "o1");
    expect(repository.updateProjectSettings).toHaveBeenCalledWith("p1", "o1", { retentionDays: 7 });
  });
});
