import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { db } from "../../src/common/db";
import { projectSettings } from "../../src/common/db/schema";
import { resolveStatusTarget } from "../../src/modules/v1/delivery/status-page/domain/resolve-status-target";
import { createOrganization, createProject } from "../support/fixtures";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";

describe.skipIf(!databaseTestsEnabled)("resolveStatusTarget", () => {
  beforeEach(resetDatabase);
  afterAll(closeDatabase);

  it("hides a project that never turned its status page on", async () => {
    const org = await createOrganization();
    const project = await createProject(org!.id, "api");

    await expect(resolveStatusTarget(org!.slug, project!.slug)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("serves the page once the project turns it on, and hides it again when turned off", async () => {
    const org = await createOrganization();
    const project = await createProject(org!.id, "api");

    await db.insert(projectSettings).values({ projectId: project!.id, statusPagePublic: true });
    await expect(resolveStatusTarget(org!.slug, project!.slug)).resolves.toEqual({ orgId: org!.id, projectId: project!.id });

    await db.update(projectSettings).set({ statusPagePublic: false });
    await expect(resolveStatusTarget(org!.slug, project!.slug)).rejects.toBeInstanceOf(NotFoundException);
  });
});
