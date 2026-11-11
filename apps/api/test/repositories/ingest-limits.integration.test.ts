import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { IngestLimitsRepository } from "../../src/modules/v1/ingest-limits/ingest-limits.repository";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";

describe.skipIf(!databaseTestsEnabled)("IngestLimitsRepository", () => {
  const repository = new IngestLimitsRepository();

  beforeEach(resetDatabase);
  afterAll(closeDatabase);

  it("creates limits scoped to organization and project", async () => {
    const created = await repository.createOrUpdateIngestLimits({
      orgId: "org-1",
      projectId: "project-1",
      maxEventsPerSecond: 500,
    });

    expect(created.orgId).toBe("org-1");
    await expect(repository.getIngestLimits("org-1", "project-1")).resolves.toMatchObject({
      maxEventsPerSecond: 500,
    });
    await expect(repository.getIngestLimits("org-2", "project-1")).resolves.toBeUndefined();
    await expect(repository.getIngestLimits("org-1", "project-2")).resolves.toBeUndefined();
  });

  it("updates an existing row instead of inserting a duplicate", async () => {
    const created = await repository.createOrUpdateIngestLimits({
      orgId: "org-1",
      projectId: "project-1",
      maxEventsPerSecond: 500,
    });

    const updated = await repository.createOrUpdateIngestLimits({
      orgId: "org-1",
      projectId: "project-1",
      maxEventsPerSecond: 900,
      sampleRate: 25,
    });

    expect(updated.id).toBe(created.id);
    expect(updated.maxEventsPerSecond).toBe(900);
    expect(updated.sampleRate).toBe(25);
  });
});
