import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/common/db";
import { deployments, environments, findings, services } from "../../src/common/db/schema";
import { FindingsService } from "../../src/modules/v1/detection/findings/application/findings.service";
import { FindingRepository } from "../../src/modules/v1/detection/findings/infrastructure/finding.repository";
import { upsertFinding } from "../../src/modules/v1/detection/findings/infrastructure/finding-upsert";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";
import { createOrganization, createProject } from "../support/fixtures";

const minute = 60_000;

describe.skipIf(!databaseTestsEnabled)("suspect deployment", () => {
  const service = new FindingsService(new FindingRepository());
  const detectedAt = new Date("2026-05-01T12:00:00.000Z");
  let orgId: string;
  let projectId: string;
  let serviceId: string;
  let environmentId: string;

  const deploy = (version: string, minutesBefore: number) =>
    db.insert(deployments).values({ serviceId, environmentId, version, commitSha: `${version}-sha`, deployedAt: new Date(detectedAt.getTime() - minutesBefore * minute) });

  const detect = async () => {
    const row = await upsertFinding({
      orgId, projectId, serviceName: "api", type: "latency", severity: "warning", title: "Slow", description: "Slow",
      observedValue: 900, threshold: 500, unit: "ms", windowStart: detectedAt, windowEnd: detectedAt, evidence: [],
      fingerprint: "latency:api:", detectedAt,
    }, detectedAt);
    return service.get(orgId, projectId, row!.id);
  };

  beforeEach(async () => {
    await resetDatabase();
    const organization = await createOrganization();
    const project = await createProject(organization!.id);
    orgId = organization!.id;
    projectId = project!.id;
    const [svc] = await db.insert(services).values({ orgId, projectId, name: "api", slug: "api" }).returning();
    const [env] = await db.insert(environments).values({ projectId, name: "Production", slug: "production", kind: "production" }).returning();
    serviceId = svc!.id;
    environmentId = env!.id;
  });
  afterAll(closeDatabase);

  it("names the latest deploy that landed shortly before the finding appeared", async () => {
    await deploy("v1", 90);
    await deploy("v2", 12);
    const found = await detect();
    expect(found.suspectDeployment).toMatchObject({ version: "v2", commitSha: "v2-sha", minutesBeforeFinding: 12 });
  });

  it("names nothing when the last deploy was long before the finding", async () => {
    await deploy("old", 600);
    expect((await detect()).suspectDeployment).toBeNull();
  });

  it("ignores deploys of other services", async () => {
    const [other] = await db.insert(services).values({ orgId, projectId, name: "worker", slug: "worker" }).returning();
    await db.insert(deployments).values({ serviceId: other!.id, environmentId, version: "w1", deployedAt: new Date(detectedAt.getTime() - 5 * minute) });
    expect((await detect()).suspectDeployment).toBeNull();
    expect(await db.select().from(findings)).toHaveLength(1);
  });
});
