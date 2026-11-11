import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/common/db";
import { EvidenceGraphRepository } from "../../src/modules/v1/intelligence/evidence-graph/evidence-graph.repository";
import type { EvidenceEdge, EvidenceNode } from "../../src/modules/v1/intelligence/evidence-graph/evidence-graph.types";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";
import { createOrganization } from "../support/fixtures";

function node(id: string, identity: Record<string, unknown>): EvidenceNode {
  return {
    id,
    type: "service",
    identity: {
      domain: "performance",
      fingerprint: id,
      fingerprintVersion: 1,
      ...identity,
    },
    data: {},
    timestamp: new Date("2026-05-01T12:00:00.000Z").toISOString(),
  };
}

describe.skipIf(!databaseTestsEnabled)("EvidenceGraphRepository", () => {
  const repository = new EvidenceGraphRepository(db);

  beforeEach(resetDatabase);
  afterAll(closeDatabase);

  it("stores and reads nodes scoped to the organization", async () => {
    const organization = await createOrganization();
    const otherOrganization = await createOrganization();
    const id = randomUUID();

    await repository.addNode(organization.id, node(id, { serviceName: "checkout" }));

    await expect(repository.getNode(organization.id, id)).resolves.toMatchObject({
      id,
      type: "service",
    });
    await expect(repository.getNode(otherOrganization.id, id)).resolves.toBeNull();
  });

  it("indexes nodes by trace, service, and deployment", async () => {
    const organization = await createOrganization();
    const traced = randomUUID();
    const serviced = randomUUID();
    const deployed = randomUUID();

    await repository.addNode(organization.id, node(traced, { resourceName: "trace-1" }));
    await repository.addNode(organization.id, node(serviced, { serviceName: "checkout" }));
    await repository.addNode(
      organization.id,
      { ...node(deployed, { serviceName: "checkout" }), data: { deploymentId: "deploy-1" } },
    );

    await expect(repository.getNodesByTrace(organization.id, "trace-1")).resolves.toHaveLength(1);
    await expect(repository.getNodesByService(organization.id, "checkout")).resolves.toHaveLength(2);
    await expect(repository.getNodesByDeployment(organization.id, "deploy-1")).resolves.toHaveLength(1);
  });

  it("stores edges and reads them in both directions", async () => {
    const organization = await createOrganization();
    const edge: EvidenceEdge = {
      id: randomUUID(),
      sourceId: "source",
      targetId: "target",
      type: "depends_on",
      strength: 0.75,
      metadata: { reason: "observed" },
    };

    await repository.addEdge(organization.id, edge);

    await expect(repository.getEdge(organization.id, edge.id)).resolves.toMatchObject({
      id: edge.id,
      strength: 0.75,
    });
    await expect(repository.getOutgoingEdges(organization.id, "source")).resolves.toHaveLength(1);
    await expect(repository.getIncomingEdges(organization.id, "target")).resolves.toHaveLength(1);
  });

  it("deletes only expired nodes and edges", async () => {
    const organization = await createOrganization();
    const expiredNode = randomUUID();
    const liveNode = randomUUID();
    const expiredEdge = randomUUID();
    const liveEdge = randomUUID();
    const past = new Date("2026-01-01T00:00:00.000Z");
    const future = new Date("2027-01-01T00:00:00.000Z");

    await repository.addNode(organization.id, node(expiredNode, {}), past);
    await repository.addNode(organization.id, node(liveNode, {}), future);
    await repository.addEdge(
      organization.id,
      { id: expiredEdge, sourceId: "a", targetId: "b", type: "causes", strength: 1 },
      past,
    );
    await repository.addEdge(
      organization.id,
      { id: liveEdge, sourceId: "a", targetId: "b", type: "causes", strength: 1 },
      future,
    );

    await expect(repository.deleteExpiredNodes()).resolves.toBe(1);
    await expect(repository.deleteExpiredEdges()).resolves.toBe(1);
    await expect(repository.getNode(organization.id, expiredNode)).resolves.toBeNull();
    await expect(repository.getNode(organization.id, liveNode)).resolves.toBeDefined();
    await expect(repository.getEdge(organization.id, expiredEdge)).resolves.toBeNull();
    await expect(repository.getEdge(organization.id, liveEdge)).resolves.toBeDefined();
  });
});
