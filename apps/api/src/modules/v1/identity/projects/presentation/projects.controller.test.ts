import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ProjectsController } from "./projects.controller";

function build() {
  const service = {
    createProject: vi.fn().mockResolvedValue({ id: "p1" }),
    updateProject: vi.fn().mockResolvedValue({ id: "p1" }),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    updateProjectSettings: vi.fn().mockResolvedValue({}),
    getProjectsForOrg: vi.fn().mockResolvedValue([]),
    getProjectById: vi.fn().mockResolvedValue({ id: "p1" }),
    getProjectSettings: vi.fn().mockResolvedValue({}),
  };
  return { service, controller: new ProjectsController(service as never) };
}

const as = (userRole: string) => ({ orgId: "org-1", userRole });

describe("ProjectsController", () => {
  it.each(["owner", "admin", "member,admin", "owner, member"])("lets the role %j create, update and delete projects", async (role) => {
    const { controller, service } = build();
    await controller.createProject(as(role), { name: "API", slug: "api" } as never);
    await controller.updateProject(as(role), "p1", { name: "New" } as never);
    await controller.deleteProject(as(role), "p1");
    expect(service.createProject).toHaveBeenCalledWith("org-1", { name: "API", slug: "api" });
    expect(service.updateProject).toHaveBeenCalledWith("p1", "org-1", { name: "New" });
    expect(service.deleteProject).toHaveBeenCalledWith("p1", "org-1");
  });

  it.each(["member", "viewer", "", "administrator", "superadmin"])("rejects the role %j when it creates, updates or deletes a project", async (role) => {
    const { controller, service } = build();
    await expect(controller.createProject(as(role), { name: "API", slug: "api" } as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.updateProject(as(role), "p1", {} as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.deleteProject(as(role), "p1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.createProject).not.toHaveBeenCalled();
    expect(service.updateProject).not.toHaveBeenCalled();
    expect(service.deleteProject).not.toHaveBeenCalled();
  });

  it("rejects a request with no role at all", async () => {
    const { controller } = build();
    await expect(controller.deleteProject({ orgId: "org-1" } as never, "p1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets a member read projects and their settings, always inside the organization", async () => {
    const { controller, service } = build();
    await controller.getProjectsForOrg(as("member"));
    await controller.getProjectById(as("member"), "p1");
    await controller.getProjectSettings(as("member"), "p1");
    expect(service.getProjectsForOrg).toHaveBeenCalledWith("org-1");
    expect(service.getProjectById).toHaveBeenCalledWith("p1", "org-1");
    expect(service.getProjectSettings).toHaveBeenCalledWith("p1", "org-1");
  });

  it("lets a member change project settings", async () => {
    const { controller, service } = build();
    await controller.updateProjectSettings(as("member"), "p1", { retentionDays: 7 } as never);
    expect(service.updateProjectSettings).toHaveBeenCalledWith("p1", "org-1", { retentionDays: 7 });
  });
});
