import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ProjectsRepository } from "../../src/modules/v1/projects/projects.repository";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";
import { createOrganization, createProject } from "../support/fixtures";

describe.skipIf(!databaseTestsEnabled)("ProjectsRepository", () => {
  const repository = new ProjectsRepository();

  beforeEach(resetDatabase);
  afterAll(closeDatabase);

  it("creates and reads a project scoped to its organization", async () => {
    const organization = await createOrganization();
    const otherOrganization = await createOrganization();

    const created = await repository.createProject({
      organizationId: organization.id,
      name: "Payments",
      slug: "payments",
    });

    await expect(repository.getProjectById(created.id, organization.id)).resolves.toMatchObject({
      id: created.id,
      name: "Payments",
    });
    await expect(repository.getProjectById(created.id, otherOrganization.id)).resolves.toBeUndefined();
  });

  it("finds a project by organization and slug", async () => {
    const organization = await createOrganization();
    await createProject(organization.id, "checkout");

    const found = await repository.getProjectByOrgAndSlug(organization.id, "checkout");

    expect(found?.slug).toBe("checkout");
  });

  it("lists only projects belonging to the organization", async () => {
    const organization = await createOrganization();
    const otherOrganization = await createOrganization();
    await createProject(organization.id, "one");
    await createProject(organization.id, "two");
    await createProject(otherOrganization.id, "three");

    const projects = await repository.getProjectsByOrgId(organization.id);

    expect(projects.map((project) => project.slug).sort()).toEqual(["one", "two"]);
  });

  it("updates a project only for its organization", async () => {
    const organization = await createOrganization();
    const otherOrganization = await createOrganization();
    const project = await createProject(organization.id);

    const updated = await repository.updateProject(project.id, otherOrganization.id, {
      name: "renamed",
    });
    const owned = await repository.updateProject(project.id, organization.id, {
      name: "renamed",
    });

    expect(updated).toBeUndefined();
    expect(owned?.name).toBe("renamed");
  });

  it("deletes a project only for its organization", async () => {
    const organization = await createOrganization();
    const otherOrganization = await createOrganization();
    const project = await createProject(organization.id);

    await repository.deleteProject(project.id, otherOrganization.id);
    await expect(repository.getProjectById(project.id, organization.id)).resolves.toBeDefined();

    await repository.deleteProject(project.id, organization.id);
    await expect(repository.getProjectById(project.id, organization.id)).resolves.toBeUndefined();
  });

  it("returns defaults until settings are written", async () => {
    const organization = await createOrganization();
    const project = await createProject(organization.id);

    const defaults = await repository.getProjectSettings(project.id, organization.id);
    const updated = await repository.updateProjectSettings(project.id, organization.id, {
      captureRequestBody: true,
      maxAttributeCount: 42,
    });

    expect(defaults.captureRequestBody).toBe(false);
    expect(defaults.maxAttributeCount).toBe(100);
    expect(updated).toMatchObject({ captureRequestBody: true, maxAttributeCount: 42 });
  });

  it("rejects settings updates for a project in another organization", async () => {
    const organization = await createOrganization();
    const otherOrganization = await createOrganization();
    const project = await createProject(organization.id);

    await expect(
      repository.updateProjectSettings(project.id, otherOrganization.id, {
        maxAttributeCount: 10,
      }),
    ).resolves.toBeNull();
  });
});
