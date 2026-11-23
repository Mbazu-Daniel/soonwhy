import { defineResource, type IsolationResource } from "@soonwhy/test-support";
import { eq } from "drizzle-orm";
import { db } from "../../src/common/db";
import { syntheticProbes } from "../../src/common/db/schema";
import { probesRepository } from "./services";
import { rowsWithId } from "./support";
import type { TestOrganization } from "./types";

type Ref = { id: number; projectId: string; name: string };

const PROBE_NAME = "homepage";
const STATS = { lastStatus: "down", uptimePercent: 0, totalChecks: 9, failedChecks: 9, lastCheckAt: new Date("2026-01-01T00:00:00.000Z") };

const scopesAsActor = (actor: TestOrganization, ref: Ref) => [
  { orgId: actor.organization.id, projectId: ref.projectId },
  { orgId: actor.organization.id, projectId: actor.project.id },
];

const resource: IsolationResource<TestOrganization, Ref> = {
  name: "synthetic probes",
  seed: async (victim) => {
    const probe = await probesRepository.createProbe(victim.organization.id, victim.project.id, {
      name: PROBE_NAME,
      url: "https://example.test",
      method: "GET",
      timeoutMs: 5000,
      intervalSeconds: 60,
      expectedStatusCode: 200,
    } as Parameters<typeof probesRepository.createProbe>[2]);
    if (!probe) throw new Error("Could not seed a probe");
    await probesRepository.createResult(probe.id, { status: "up", statusCode: 200, responseTimeMs: 10, errorMessage: null });
    return { id: probe.id, projectId: victim.project.id, name: PROBE_NAME };
  },
  intact: async (ref) => {
    const [row] = await db.select().from(syntheticProbes).where(eq(syntheticProbes.id, ref.id));
    return row?.name === ref.name && row.totalChecks !== STATS.totalChecks;
  },
  cases: {
    list: {
      attempts: ({ actor, ref }) => ({
        "the other project with the actor's organization": async () => rowsWithId(await probesRepository.getProbes(actor.organization.id, ref.projectId), ref.id),
        "the probe's results, scoped to the actor": async () => (await Promise.all(scopesAsActor(actor, ref).map((scope) => probesRepository.getProbeResults(scope, ref.id)))).flat(),
      }),
      owner: ({ owner, ref }) => probesRepository.getProbeResults({ orgId: owner.organization.id, projectId: ref.projectId }, ref.id),
    },
    read: {
      attempts: ({ actor, ref }) => ({
        "by id, scoped to the actor": async () => (await Promise.all(scopesAsActor(actor, ref).map((scope) => probesRepository.getProbeById(scope, ref.id)))).filter(Boolean),
      }),
      owner: ({ owner, ref }) => probesRepository.getProbeById({ orgId: owner.organization.id, projectId: ref.projectId }, ref.id),
    },
    update: {
      attempts: ({ actor, ref }) => ({
        rename: async () => (await Promise.all(scopesAsActor(actor, ref).map((scope) => probesRepository.updateProbe(scope, ref.id, { name: "taken over" })))).filter(Boolean),
        "overwrite the stats": async () => {
          await Promise.all(scopesAsActor(actor, ref).map((scope) => probesRepository.updateProbeStats(scope, ref.id, STATS)));
        },
      }),
      owner: ({ owner, ref }) => probesRepository.updateProbe({ orgId: owner.organization.id, projectId: ref.projectId }, ref.id, { name: PROBE_NAME }),
    },
    delete: {
      attempts: ({ actor, ref }) => ({
        remove: async () => (await Promise.all(scopesAsActor(actor, ref).map((scope) => probesRepository.deleteProbe(scope, ref.id)))).filter(Boolean),
      }),
      owner: ({ owner, ref }) => probesRepository.deleteProbe({ orgId: owner.organization.id, projectId: ref.projectId }, ref.id),
    },
  },
};

export const probeResource = defineResource(resource);
